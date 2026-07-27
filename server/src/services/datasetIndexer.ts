/**
 * datasetIndexer.ts
 * ─────────────────
 * Per-subject file indexer.
 * Uploads go to: data/uploads/{subjectId}/{docType}/{filename}
 * Vector store metadata: { subjectId, documentType, source, chunkIndex, text, pageNumbers }
 *
 * documentType: 'syllabus' | 'reference'
 * Priority during retrieval: syllabus first for structure, reference for content.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parse as parseCsv } from 'csv-parse/sync';
import * as vectorStore from './vectorStore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');

export type DocumentType = 'syllabus' | 'reference';

export const UPLOADS_BASE = path.resolve(process.env.UPLOADS_PATH ?? './data/uploads');
const HASH_CACHE_PATH = path.join(process.cwd(), 'data', 'dataset-hashes.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadHashCache(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(HASH_CACHE_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveHashCache(cache: Record<string, string>) {
  fs.mkdirSync(path.dirname(HASH_CACHE_PATH), { recursive: true });
  fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache, null, 2));
}

function fileHash(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function getSubjectDir(subjectId: string, docType: DocumentType): string {
  return path.join(UPLOADS_BASE, subjectId, docType);
}

// ── Text Extraction ───────────────────────────────────────────────────────────

export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buf = fs.readFileSync(filePath);
    const parsed = await pdfParse(buf);
    return parsed.text;
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value as string;
  }
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parseCsv(content, { columns: true, skip_empty_lines: true });
    return JSON.stringify(records, null, 2);
  }
  if (['.txt', '.md', '.mdx', '.json'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

// ── Chunking ──────────────────────────────────────────────────────────────────

interface Chunk {
  text: string;
  source: string;
  pageNumbers: number[];
}

function chunkText(text: string, fileName: string, chunkSize = 1000, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30);
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length > chunkSize && buffer.length > 0) {
      chunks.push({ text: buffer.trim(), source: fileName, pageNumbers: [1] });
      const words = buffer.split(' ');
      buffer = words.slice(Math.max(0, words.length - Math.floor(overlap / 5))).join(' ');
    }
    buffer += (buffer ? '\n\n' : '') + para;
  }

  if (buffer.trim().length > 30) {
    chunks.push({ text: buffer.trim(), source: fileName, pageNumbers: [1] });
  }
  return chunks;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' }, { apiVersion: 'v1' } as any);
  const embeddings: number[][] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(text =>
        model.embedContent({
          content: { role: 'user', parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT' as any,
        }).then(r => r.embedding.values)
      )
    );
    embeddings.push(...results);
    if (i + BATCH_SIZE < texts.length) await new Promise(r => setTimeout(r, 200));
  }
  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' }, { apiVersion: 'v1' } as any);
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: query }] },
    taskType: 'RETRIEVAL_QUERY' as any,
  });
  return result.embedding.values;
}

// ── Main Index Function ───────────────────────────────────────────────────────

export async function indexSubjectFile(
  subjectId: string,
  filePath: string,
  docType: DocumentType
): Promise<{ chunks: number }> {
  const fileName = path.basename(filePath);
  const resourceId = `${subjectId}_${docType}_${crypto.createHash('md5').update(filePath).digest('hex')}`;

  const hashCache = loadHashCache();
  const currentHash = fileHash(filePath);

  if (hashCache[resourceId] === currentHash) {
    console.log(`[indexer] Unchanged: ${fileName} — skipping`);
    return { chunks: 0 };
  }

  console.log(`[indexer] Indexing [${docType}]: ${fileName} for subject ${subjectId}`);

  const text = await extractText(filePath);
  if (!text || text.trim().length < 50) {
    console.warn(`[indexer] Too little text in ${fileName}`);
    return { chunks: 0 };
  }

  const chunks = chunkText(text, fileName);
  if (chunks.length === 0) return { chunks: 0 };

  const embeddings = await generateEmbeddings(chunks.map(c => c.text));

  await vectorStore.upsertSubjectChunks(resourceId, subjectId, docType, chunks, embeddings);

  hashCache[resourceId] = currentHash;
  saveHashCache(hashCache);

  console.log(`[indexer] ✅ Indexed ${fileName} — ${chunks.length} chunks [${docType}]`);
  return { chunks: chunks.length };
}

// ── File Management ───────────────────────────────────────────────────────────

export async function saveUploadedFile(
  subjectId: string,
  docType: DocumentType,
  file: Express.Multer.File
): Promise<string> {
  const dir = getSubjectDir(subjectId, docType);
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, file.originalname);
  fs.writeFileSync(destPath, file.buffer);
  return destPath;
}

export function getUploadedFiles(subjectId: string): {
  syllabus: string[];
  reference: string[];
} {
  const result = { syllabus: [] as string[], reference: [] as string[] };
  for (const docType of ['syllabus', 'reference'] as DocumentType[]) {
    const dir = getSubjectDir(subjectId, docType);
    if (fs.existsSync(dir)) {
      result[docType] = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
    }
  }
  return result;
}

export function deleteUploadedFile(
  subjectId: string,
  docType: DocumentType,
  fileName: string
): boolean {
  const filePath = path.join(getSubjectDir(subjectId, docType), fileName);
  if (!fs.existsSync(filePath)) return false;
  const resourceId = `${subjectId}_${docType}_${crypto.createHash('md5').update(filePath).digest('hex')}`;
  fs.unlinkSync(filePath);
  // Remove from vector store and hash cache
  vectorStore.deleteByResourceId(resourceId).catch(() => {});
  const cache = loadHashCache();
  delete cache[resourceId];
  saveHashCache(cache);
  return true;
}

export function getFullFilePath(
  subjectId: string,
  docType: DocumentType,
  fileName: string
): string {
  return path.join(getSubjectDir(subjectId, docType), fileName);
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

export async function retrieveForSubject(
  subjectId: string,
  query: string,
  topK = 8,
  docTypeFilter?: DocumentType
): Promise<vectorStore.SearchResult[]> {
  const queryEmbedding = await embedQuery(query);
  return vectorStore.searchBySubjectId(subjectId, queryEmbedding, topK, docTypeFilter);
}
