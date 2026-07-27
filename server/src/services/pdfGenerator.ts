/**
 * pdfGenerator.ts
 * ───────────────
 * Generates professional PDFs from Markdown content using Puppeteer.
 * Markdown → HTML (with syntax highlight + Mermaid) → PDF
 *
 * Output path: data/pdfs/{subjectId}/module_{n}.pdf
 */

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const PDF_OUTPUT_BASE = path.resolve(process.env.PDF_OUTPUT_PATH ?? './data/pdfs');

function getPdfPath(subjectId: string, moduleNumber: number): string {
  return path.join(PDF_OUTPUT_BASE, subjectId, `module_${moduleNumber}.pdf`);
}

function getPdfDir(subjectId: string): string {
  return path.join(PDF_OUTPUT_BASE, subjectId);
}

// ── HTML Template ─────────────────────────────────────────────────────────────

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
    throw new Error('Markdown produced no HTML content — cannot generate PDF');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Module ${moduleNumber} — ${moduleTitle} | ${subjectName}</title>
  <style>
    /* NO external font imports — system fonts only to prevent network hangs */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #1a1a2e;
      background: white;
    }

    .cover {
      page-break-after: always;
      min-height: 250mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .cover-badge {
      font-size: 60px;
      margin-bottom: 24px;
    }

    .cover-subject {
      font-size: 13pt;
      font-weight: 600;
      letter-spacing: 3px;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 16px;
    }

    .cover-module {
      font-size: 28pt;
      font-weight: 900;
      line-height: 1.2;
      margin-bottom: 12px;
    }

    .cover-title {
      font-size: 18pt;
      font-weight: 500;
      opacity: 0.9;
      margin-bottom: 40px;
    }

    .cover-meta {
      font-size: 10pt;
      opacity: 0.7;
      border-top: 1px solid rgba(255,255,255,0.3);
      padding-top: 20px;
    }

    .content {
      padding: 40px 50px;
      max-width: 100%;
    }

    h1 {
      font-size: 22pt;
      font-weight: 900;
      color: #1a1a2e;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
      margin: 32px 0 20px;
      page-break-after: avoid;
    }

    h2 {
      font-size: 16pt;
      font-weight: 700;
      color: #3730a3;
      margin: 28px 0 14px;
      page-break-after: avoid;
      border-left: 4px solid #667eea;
      padding-left: 12px;
    }

    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #1e1b4b;
      margin: 22px 0 10px;
      page-break-after: avoid;
    }

    h4 {
      font-size: 11pt;
      font-weight: 600;
      color: #4338ca;
      margin: 16px 0 8px;
    }

    p {
      margin-bottom: 12px;
    }

    ul, ol {
      margin: 10px 0 14px 24px;
    }

    li {
      margin-bottom: 5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 20px;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    th {
      background: #4338ca;
      color: white;
      font-weight: 600;
      padding: 10px 12px;
      text-align: left;
    }

    td {
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1px 5px;
    }

    pre {
      background: #1e1b4b;
      color: #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      overflow-x: auto;
      margin: 14px 0;
      font-size: 9.5pt;
      line-height: 1.5;
      page-break-inside: avoid;
    }

    pre code {
      background: none;
      border: none;
      color: inherit;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid #667eea;
      padding: 10px 16px;
      background: #f0f0ff;
      margin: 14px 0;
      border-radius: 0 6px 6px 0;
    }

    strong {
      font-weight: 700;
      color: #1e1b4b;
    }

    hr {
      border: none;
      border-top: 2px solid #e2e8f0;
      margin: 24px 0;
    }

    .lecture-separator {
      page-break-before: always;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      table, pre, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-badge">📚</div>
    <div class="cover-subject">${subjectName}</div>
    <div class="cover-module">Module ${moduleNumber}</div>
    <div class="cover-title">${moduleTitle}</div>
    <div class="cover-meta">
      Generated by TCET AI University Notes Generator<br>
      ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>

  <!-- Content -->
  <div class="content">
    ${htmlBody}
  </div>

</body>
</html>`;
}

// ── PDF Generation ────────────────────────────────────────────────────────────

export async function generateModulePdf(
  subjectId: string,
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  markdownContent: string
): Promise<string> {
  return Promise.race([
    generateModulePdfInternal(subjectId, subjectName, moduleNumber, moduleTitle, markdownContent),
    new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('PDF generation timed out (25s limit)')), 25000)
    )
  ]);
}

async function generateModulePdfInternal(
  subjectId: string,
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  markdownContent: string
): Promise<string> {
  const outputDir = getPdfDir(subjectId);
  const outputPath = getPdfPath(subjectId, moduleNumber);
  fs.mkdirSync(outputDir, { recursive: true });

  const html = buildHtml(subjectName, moduleNumber, moduleTitle, markdownContent);

  // Try to find a system-installed Chrome/Chromium before using Puppeteer's bundled one
  const systemChromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
    process.env.CHROME_PATH ?? '',
  ].filter(p => p && fs.existsSync(p));

  const executablePath = systemChromePaths[0] ?? undefined;

  // Dynamic import puppeteer to avoid startup cost
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--no-first-run',
    ],
    timeout: 30000,
  });

  try {
    const page = await browser.newPage();

    // Block ALL external network requests — PDF must be 100% offline
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue();
      } else {
        req.abort(); // Block fonts, images, scripts from external URLs
      }
    });

    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });

    // Ensure fonts and multi-page layout are fully settled before capture
    await page.waitForSelector('.content', { timeout: 10000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.evaluate(async () => {
      let lastHeight = 0;
      for (let i = 0; i < 20; i++) {
        const height = document.body.scrollHeight;
        if (height > 0 && height === lastHeight) break;
        lastHeight = height;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    const contentText = await page.$eval('.content', (el) => el.textContent?.trim() ?? '');
    if (contentText.length < 20) {
      throw new Error('PDF content area is empty — notes may not have finished generating');
    }

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1.5cm', right: '2cm', bottom: '2cm', left: '2cm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      timeout: 30000,
      footerTemplate: `
        <div style="font-size: 9pt; color: #999; width: 100%; text-align: right; padding-right: 20px; padding-bottom: 5px;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}

// ── Status Helpers ────────────────────────────────────────────────────────────

export function getPdfStatus(subjectId: string): Record<number, boolean> {
  const dir = getPdfDir(subjectId);
  const status: Record<number, boolean> = {};
  for (let i = 1; i <= 6; i++) {
    status[i] = fs.existsSync(path.join(dir, `module_${i}.pdf`));
  }
  return status;
}

export function getPdfPathIfExists(subjectId: string, moduleNumber: number): string | null {
  const p = getPdfPath(subjectId, moduleNumber);
  return fs.existsSync(p) ? p : null;
}

export function deletePdf(subjectId: string, moduleNumber: number): void {
  const p = getPdfPath(subjectId, moduleNumber);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
