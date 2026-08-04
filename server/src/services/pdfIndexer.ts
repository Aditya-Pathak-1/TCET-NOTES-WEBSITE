/**
 * pdfIndexer.ts
 * ─────────────
 * RAG pipeline: PDF → text extraction → chunking → embeddings → vector store.
 *
 * Called automatically after a PDF resource is created, updated, or deleted.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
// Using native fetch to Gemini REST API v1beta for embeddings
import * as vectorStore from './vectorStore';
import prisma from '../db/database';
import { UPLOADS_DIR } from '../utils/fileUtils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;


// ── Hash cache (prevents re-indexing unchanged files) ─────────────────────────
const hashCachePath = path.join(process.cwd(), 'data', 'index-hashes.json');

function loadHashCache(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(hashCachePath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveHashCache(cache: Record<string, string>) {
  fs.mkdirSync(path.dirname(hashCachePath), { recursive: true });
  fs.writeFileSync(hashCachePath, JSON.stringify(cache, null, 2));
}

function fileHash(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── Text chunking ─────────────────────────────────────────────────────────────
interface Chunk {
  text: string;
  pageNumbers: number[];
  source: string;
}

/**
 * Splits a large text into overlapping semantic chunks.
 */
function chunkText(
  text: string,
  fileName: string,
  pages: string[],
  chunkSize = 800,
  overlap = 100
): Chunk[] {
  const chunks: Chunk[] = [];

  // Simple paragraph-aware splitter
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 20);

  let buffer = '';
  const avgCharsPerPage = Math.max(1, text.length / Math.max(1, pages.length));

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length > chunkSize && buffer.length > 0) {
      // Estimate page numbers from character position
      const startPage = Math.ceil(
        (text.indexOf(buffer.slice(0, 40)) / avgCharsPerPage) + 1
      );
      chunks.push({
        text: buffer.trim(),
        pageNumbers: [Math.max(1, startPage)],
        source: fileName,
      });
      // Keep overlap
      const words = buffer.split(' ');
      buffer = words.slice(Math.max(0, words.length - overlap / 10)).join(' ');
    }
    buffer += (buffer ? '\n\n' : '') + para;
  }

  if (buffer.trim().length > 20) {
    chunks.push({
      text: buffer.trim(),
      pageNumbers: [1],
      source: fileName,
    });
  }

  return chunks;
}

// ── Embedding generation ──────────────────────────────────────────────────────

/**
 * Generates embeddings for an array of text chunks using Gemini.
 * Batches requests to stay within API rate limits.
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
  const BATCH_SIZE = 10;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const body = {
      requests: batch.map(text => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      })),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error ${res.status}: ${err}`);
    }
    const json = (await res.json()) as any;
    for (const emb of json.embeddings) {
      embeddings.push(emb.values);
    }
    if (i + BATCH_SIZE < texts.length) await new Promise(r => setTimeout(r, 200));
  }
  return embeddings;
}

// ── Main indexing function ────────────────────────────────────────────────────

/**
 * Full RAG pipeline for a resource:
 * 1. Read PDF from disk
 * 2. Extract text + page info
 * 3. Chunk the text
 * 4. Generate embeddings
 * 5. Store in vector index
 */
export async function indexResource(resourceId: string): Promise<void> {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    console.warn(`[indexer] Resource ${resourceId} not found, skipping.`);
    return;
  }

  // Only index PDFs and document-type files
  const indexableMimes = ['application/pdf', 'application/octet-stream'];
  const indexableExts = ['.pdf'];
  const ext = path.extname(resource.fileName).toLowerCase();

  if (!indexableExts.includes(ext) && !indexableMimes.includes(resource.mimeType)) {
    console.log(`[indexer] Skipping non-PDF resource: ${resource.title}`);
    return;
  }

  const absPath = path.join(UPLOADS_DIR, ...resource.filePath.split('/'));
  if (!fs.existsSync(absPath)) {
    console.warn(`[indexer] File not found on disk: ${absPath}`);
    return;
  }

  // Deduplication: skip if file hasn't changed
  const hashCache = loadHashCache();
  const currentHash = fileHash(absPath);
  if (hashCache[resourceId] === currentHash) {
    console.log(`[indexer] ${resource.title} — unchanged, skipping re-index.`);
    return;
  }

  console.log(`[indexer] Indexing: ${resource.title} (${resource.fileName})`);

  try {
    // Extract text
    const pdfBuffer = fs.readFileSync(absPath);
    const parsed = await pdfParse(pdfBuffer);

    if (!parsed.text || parsed.text.trim().length < 50) {
      console.warn(`[indexer] ${resource.title} — too little text extracted, skipping.`);
      return;
    }

    // Get page-separated text (pdf-parse gives us numpages)
    const pages: string[] = [];
    for (let i = 0; i < parsed.numpages; i++) {
      pages.push(''); // placeholder — pdf-parse gives full text, not per-page
    }

    // Chunk
    const chunks = chunkText(parsed.text, resource.fileName, pages);
    console.log(`[indexer] ${chunks.length} chunks created for ${resource.title}`);

    if (chunks.length === 0) {
      console.warn(`[indexer] No chunks generated, skipping.`);
      return;
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks.map(c => c.text));

    // Upsert into vector store
    await vectorStore.upsertChunks(
      resourceId,
      resource.subjectId,
      chunks,
      embeddings
    );

    // Save hash to prevent re-indexing
    hashCache[resourceId] = currentHash;
    saveHashCache(hashCache);

    console.log(`[indexer] ✅ Indexed ${resource.title} — ${chunks.length} chunks`);
  } catch (err) {
    console.error(`[indexer] ❌ Failed to index ${resource.title}:`, err);
    // Don't rethrow — indexing failure shouldn't break the upload response
  }
}

/**
 * Remove a resource from the vector index (called on resource delete).
 */
export async function deleteResourceIndex(resourceId: string): Promise<void> {
  await vectorStore.deleteByResourceId(resourceId);

  // Remove from hash cache
  const hashCache = loadHashCache();
  delete hashCache[resourceId];
  saveHashCache(hashCache);

  console.log(`[indexer] Removed index for resource ${resourceId}`);
}

/**
 * Generate a query embedding (for similarity search).
 */
export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
  const body = {
    requests: [{
      model: 'models/text-embedding-004',
      content: { parts: [{ text: query }] },
      taskType: 'RETRIEVAL_QUERY',
    }],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }
  const json = (await res.json()) as any;
  return json.embeddings[0].values;
}
