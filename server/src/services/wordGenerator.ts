/**
 * wordGenerator.ts
 * ───────────────
 * Generates professional Word documents from Markdown content using html-to-docx.
 * Markdown → HTML → DOCX
 *
 * Output path: data/docx/{subjectId}/module_{n}.docx
 */

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
// @ts-ignore - html-to-docx doesn't have types in this setup
import HTMLtoDOCX from 'html-to-docx';

const DOCX_OUTPUT_BASE = path.resolve(process.env.DOCX_OUTPUT_PATH ?? './data/docx');

function getDocxPath(subjectId: string, moduleNumber: number): string {
  return path.join(DOCX_OUTPUT_BASE, subjectId, `module_${moduleNumber}.docx`);
}

function getDocxDir(subjectId: string): string {
  return path.join(DOCX_OUTPUT_BASE, subjectId);
}

function markdownToHtml(markdownContent: string): string {
  const parsed = marked.parse(markdownContent);
  if (typeof parsed !== 'string') {
    throw new Error('Markdown parser returned unexpected async result');
  }
  return parsed;
}

function buildHtml(
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  markdownContent: string
): string {
  const htmlBody = markdownToHtml(markdownContent);
  if (!htmlBody.trim()) {
    throw new Error('Markdown produced no HTML content — cannot generate DOCX');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Module ${moduleNumber} — ${moduleTitle} | ${subjectName}</title>
</head>
<body>
  <div style="text-align: center; margin-bottom: 50px;">
    <h1>${subjectName}</h1>
    <h2>Module ${moduleNumber}</h2>
    <h3>${moduleTitle}</h3>
  </div>
  <hr />
  ${htmlBody}
</body>
</html>`;
}

export async function generateModuleDocx(
  subjectId: string,
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  markdownContent: string
): Promise<string> {
  const outputDir = getDocxDir(subjectId);
  const outputPath = getDocxPath(subjectId, moduleNumber);
  fs.mkdirSync(outputDir, { recursive: true });

  const html = buildHtml(subjectName, moduleNumber, moduleTitle, markdownContent);

  const fileBuffer = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  fs.writeFileSync(outputPath, fileBuffer as any);

  return outputPath;
}

export function getDocxStatus(subjectId: string): Record<number, boolean> {
  const dir = getDocxDir(subjectId);
  const status: Record<number, boolean> = {};
  for (let i = 1; i <= 6; i++) {
    status[i] = fs.existsSync(path.join(dir, `module_${i}.docx`));
  }
  return status;
}

export function getDocxPathIfExists(subjectId: string, moduleNumber: number): string | null {
  const p = getDocxPath(subjectId, moduleNumber);
  return fs.existsSync(p) ? p : null;
}

export function deleteDocx(subjectId: string, moduleNumber: number): void {
  const p = getDocxPath(subjectId, moduleNumber);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
