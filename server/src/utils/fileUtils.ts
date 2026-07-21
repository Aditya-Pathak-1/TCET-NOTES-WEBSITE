import path from 'path';
import fs from 'fs';

export const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/** Ensures a subdirectory inside uploads/ exists and returns its absolute path */
export function ensureDir(subPath: string): string {
  const dir = path.join(UPLOADS_DIR, subPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Deletes a file or directory (recursively) — no-op if it doesn't exist */
export function deletePath(target: string): void {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    fs.rmSync(target, { recursive: true, force: true });
  } else {
    fs.unlinkSync(target);
  }
}

/** Resolves a relative filePath (as stored in DB) to an absolute filesystem path */
export function resolveUploadPath(relPath: string): string {
  return path.join(UPLOADS_DIR, relPath);
}

/** Human-readable file size */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
