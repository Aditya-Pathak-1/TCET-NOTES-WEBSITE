/**
 * vectorStore.ts
 * ──────────────
 * Wraps the `vectra` LocalIndex for zero-infrastructure vector storage.
 * Metadata schema: { resourceId, subjectId, documentType, chunkIndex, text, source, pageNumbers }
 */

import path from 'path';
import fs from 'fs';
import { LocalIndex } from 'vectra';
import type { DocumentType } from './datasetIndexer';

const INDEX_PATH =
  process.env.VECTOR_INDEX_PATH ??
  path.join(process.cwd(), 'data', 'vector-index');

fs.mkdirSync(INDEX_PATH, { recursive: true });

let _index: LocalIndex | null = null;

async function getIndex(): Promise<LocalIndex> {
  if (_index) return _index;
  _index = new LocalIndex(INDEX_PATH);
  if (!(await _index.isIndexCreated())) {
    await _index.createIndex({ version: 1, deleteIfExists: false });
  }
  return _index;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChunkMetadata {
  resourceId: string;
  subjectId: string;
  documentType: string; // 'syllabus' | 'reference' | 'dataset'
  chunkIndex: number;
  text: string;
  source: string;
  pageNumbers: number[];
}

export interface SearchResult {
  text: string;
  score: number;
  source: string;
  pageNumbers: number[];
  resourceId: string;
  documentType: string;
}

// ── Upsert ────────────────────────────────────────────────────────────────────

export async function upsertSubjectChunks(
  resourceId: string,
  subjectId: string,
  documentType: DocumentType,
  chunks: { text: string; source: string; pageNumbers: number[] }[],
  embeddings: number[][]
): Promise<void> {
  const index = await getIndex();
  await deleteByResourceId(resourceId);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = embeddings[i];
    if (!vector || vector.length === 0) continue;

    const metadata: ChunkMetadata = {
      resourceId,
      subjectId,
      documentType,
      chunkIndex: i,
      text: chunk.text,
      source: chunk.source,
      pageNumbers: chunk.pageNumbers,
    };

    await index.insertItem({
      vector,
      metadata: metadata as unknown as Record<string, string | number | boolean>,
    });
  }
}

// Kept for backward compatibility
export async function upsertChunks(
  resourceId: string,
  subjectId: string,
  chunks: { text: string; source: string; pageNumbers: number[] }[],
  embeddings: number[][]
): Promise<void> {
  return upsertSubjectChunks(resourceId, subjectId, 'reference', chunks, embeddings);
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchBySubjectId(
  subjectId: string,
  queryEmbedding: number[],
  topK = 8,
  docTypeFilter?: DocumentType
): Promise<SearchResult[]> {
  const index = await getIndex();
  const results = await index.queryItems(queryEmbedding, '', topK * 6);

  return results
    .filter(r => {
      const meta = r.item.metadata as unknown as ChunkMetadata;
      if (meta.subjectId !== subjectId) return false;
      if (docTypeFilter && meta.documentType !== docTypeFilter) return false;
      return true;
    })
    .slice(0, topK)
    .map(r => {
      const meta = r.item.metadata as unknown as ChunkMetadata;
      return {
        text: meta.text as string,
        score: r.score,
        source: meta.source as string,
        pageNumbers: (meta.pageNumbers ?? []) as number[],
        resourceId: meta.resourceId as string,
        documentType: meta.documentType as string,
      };
    });
}

// Legacy search functions kept for compatibility
export async function search(
  subjectId: string,
  queryEmbedding: number[],
  topK = 5
): Promise<SearchResult[]> {
  return searchBySubjectId(subjectId, queryEmbedding, topK);
}

export async function searchBySubjectAndModule(
  subjectName: string,
  _moduleName: string,
  queryEmbedding: number[],
  topK = 5
): Promise<SearchResult[]> {
  return searchBySubjectId(subjectName, queryEmbedding, topK);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteByResourceId(resourceId: string): Promise<void> {
  const index = await getIndex();
  const allItems = await index.listItems();
  const toDelete = allItems
    .filter(item => (item.metadata as unknown as ChunkMetadata).resourceId === resourceId)
    .map(item => item.id as string)
    .filter(Boolean);
  for (const id of toDelete) {
    await index.deleteItem(id);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getIndexedChunkCount(resourceId: string): Promise<number> {
  const index = await getIndex();
  const allItems = await index.listItems();
  return allItems.filter(
    item => (item.metadata as unknown as ChunkMetadata).resourceId === resourceId
  ).length;
}

export async function getIndexedSubjectIds(): Promise<string[]> {
  const index = await getIndex();
  const allItems = await index.listItems();
  const ids = new Set(
    allItems.map(item => (item.metadata as unknown as ChunkMetadata).subjectId as string)
  );
  return [...ids];
}

// Backward-compat shims
export async function upsertDatasetChunks(
  resourceId: string,
  subjectName: string,
  moduleName: string,
  chunks: { text: string; source: string; pageNumbers: number[] }[],
  embeddings: number[][]
): Promise<void> {
  return upsertSubjectChunks(resourceId, subjectName, 'reference', chunks, embeddings);
}
