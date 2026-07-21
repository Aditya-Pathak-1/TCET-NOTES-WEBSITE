import type { ResourceType } from '../types';

/** Human-readable file size */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format ISO string as "Jul 21, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Returns true if the resource can be previewed inline */
export function canPreview(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

/** Returns the icon emoji for a resource type */
export function resourceTypeIcon(type: ResourceType): string {
  const icons: Record<ResourceType, string> = {
    syllabus:       '📋',
    notes:          '📝',
    material:       '📄',
    pdf:            '📕',
    docx:           '📘',
    ppt:            '📊',
    image:          '🖼️',
    'flashcard-deck': '🃏',
  };
  return icons[type] ?? '📎';
}

/** Hex color → lighter background tint (10% opacity) as rgba */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Truncate a string to maxLen chars */
export function truncate(str: string, maxLen = 60): string {
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}…`;
}
