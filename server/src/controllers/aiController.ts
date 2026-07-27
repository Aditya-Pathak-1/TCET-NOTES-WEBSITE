/**
 * aiController.ts
 * ───────────────
 * All AI Notes Generator API endpoints.
 *
 * GET  /ai/subjects                                    — list 6 fixed subjects
 * GET  /ai/subjects/:subjectId/status                  — upload status + pdf status
 * POST /ai/subjects/:subjectId/upload                  — upload syllabus or reference book
 * DELETE /ai/subjects/:subjectId/files/:docType/:name  — delete a file
 * POST /ai/subjects/:subjectId/modules/:moduleNum/plan — plan lectures for a module
 * POST /ai/subjects/:subjectId/modules/:moduleNum/generate — SSE: stream module notes
 * GET  /ai/subjects/:subjectId/modules/:moduleNum/pdf  — download generated PDF
 * POST /ai/subjects/:subjectId/modules/:moduleNum/pdf  — generate PDF from saved markdown
 */

import fs from 'fs';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getAllSubjects, getSubjectById } from '../services/subjectRegistry';
import {
  indexSubjectFile,
  saveUploadedFile,
  getUploadedFiles,
  deleteUploadedFile,
  extractText,
  getFullFilePath,
} from '../services/datasetIndexer';
import { planModule, generateLecture } from '../services/llmService';
import type { ContextChunk } from '../services/llmService';
import {
  generateModulePdf,
  getPdfStatus,
  getPdfPathIfExists,
  deletePdf,
} from '../services/pdfGenerator';
import path from 'path';
import type { DocumentType } from '../services/datasetIndexer';

// ── Markdown persistence helpers ───────────────────────────────────────────────
const MARKDOWN_DIR = path.resolve('./data/markdown');

function getMarkdownPath(subjectId: string, moduleNumber: number): string {
  return path.join(MARKDOWN_DIR, subjectId, `module_${moduleNumber}.md`);
}

function saveMarkdownToDisk(subjectId: string, moduleNumber: number, content: string): void {
  const dir = path.join(MARKDOWN_DIR, subjectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getMarkdownPath(subjectId, moduleNumber), content, 'utf-8');
}

function loadMarkdownFromDisk(subjectId: string, moduleNumber: number): string | null {
  const p = getMarkdownPath(subjectId, moduleNumber);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads all uploaded files of a given docType for a subject and returns them
 * as ContextChunk[] without needing embeddings or a vector store.
 */
async function readFilesAsContext(
  subjectId: string,
  docType: DocumentType,
  maxChars = 12000
): Promise<ContextChunk[]> {
  const files = getUploadedFiles(subjectId);
  const fileNames = files[docType];
  const chunks: ContextChunk[] = [];

  for (const fileName of fileNames) {
    const filePath = getFullFilePath(subjectId, docType, fileName);
    if (!fs.existsSync(filePath)) continue;
    const text = await extractText(filePath);
    if (!text || text.trim().length < 20) continue;
    // Truncate to avoid hitting token limits
    chunks.push({
      text: text.slice(0, maxChars),
      source: fileName,
      pageNumbers: [1],
    });
  }

  return chunks;
}

// ── GET /ai/subjects ──────────────────────────────────────────────────────────

export const getSubjects = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: getAllSubjects() });
});

// ── GET /ai/subjects/:subjectId/status ────────────────────────────────────────

export const getSubjectStatus = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const files = getUploadedFiles(subjectId);
  const pdfStatus = getPdfStatus(subjectId);

  res.json({
    data: {
      subject,
      files,
      pdfStatus,
      hasSyllabus: files.syllabus.length > 0,
      hasReference: files.reference.length > 0,
    },
  });
});

// ── POST /ai/subjects/:subjectId/upload ───────────────────────────────────────

export const uploadSubjectFile = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const docType = (req.body.docType ?? 'reference') as DocumentType;

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Save file to disk
  const filePath = await saveUploadedFile(subjectId, docType, req.file);

  // Index file in background (non-blocking)
  indexSubjectFile(subjectId, filePath, docType).catch(err =>
    console.error('[upload] Background indexing failed:', err)
  );

  res.status(201).json({
    data: {
      message: 'File uploaded and indexing started',
      fileName: req.file.originalname,
      docType,
    },
  });
});

// ── DELETE /ai/subjects/:subjectId/files/:docType/:fileName ───────────────────

export const deleteSubjectFile = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, docType, fileName } = req.params;

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const ok = deleteUploadedFile(subjectId, docType as DocumentType, decodeURIComponent(fileName));
  if (!ok) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.json({ data: { message: 'File deleted' } });
});

// ── POST /ai/subjects/:subjectId/modules/:moduleNum/plan ──────────────────────

export const planModuleNotes = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }
  if (isNaN(moduleNumber) || moduleNumber < 1 || moduleNumber > 6) {
    res.status(400).json({ error: 'moduleNum must be 1-6' });
    return;
  }

  // Read syllabus files directly (no embeddings needed)
  const syllabusChunks = await readFilesAsContext(subjectId, 'syllabus');

  if (syllabusChunks.length === 0) {
    res.status(422).json({
      error: 'No syllabus uploaded for this subject. Please upload the syllabus PDF first.',
    });
    return;
  }

  const plan = await planModule(subject.name, moduleNumber, syllabusChunks);
  res.json({ data: plan });
});

// ── POST /ai/subjects/:subjectId/modules/:moduleNum/generate ──────────────────

/**
 * Streams the full module notes lecture-by-lecture via SSE.
 *
 * Body: { plan: ModulePlan }   (from the /plan endpoint)
 *
 * SSE events:
 *   { type: 'lecture_start', lectureNumber, lectureTitle }
 *   { type: 'chunk', chunk: string }
 *   { type: 'lecture_done', lectureNumber }
 *   { type: 'pdf_ready', pdfUrl }
 *   { type: 'done' }
 *   { type: 'error', message }
 */
export const generateModuleNotes = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);
  const { plan } = req.body as { plan: import('../services/llmService').ModulePlan };

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }
  if (!plan || !plan.lectures || plan.lectures.length === 0) {
    res.status(400).json({ error: 'plan with lectures is required in request body' });
    return;
  }

  // Delete existing PDF so it regenerates fresh
  deletePdf(subjectId, moduleNumber);

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let fullMarkdown = `# Module ${moduleNumber} — ${plan.moduleTitle}\n\n`;
    fullMarkdown += `**Subject:** ${subject.name}  \n`;
    fullMarkdown += `**Total Lectures:** ${plan.lectures.length} | **Total Hours:** ${plan.totalHours}\n\n---\n\n`;

    for (const lecture of plan.lectures) {
      send({ type: 'lecture_start', lectureNumber: lecture.lectureNumber, lectureTitle: lecture.title });

      // Read context directly from files (no embeddings needed)
      const [syllabusChunks, referenceChunks] = await Promise.all([
        readFilesAsContext(subjectId, 'syllabus', 6000),
        readFilesAsContext(subjectId, 'reference', 10000),
      ]);

      let lectureMarkdown = '';
      for await (const chunk of generateLecture(
        subject.name,
        moduleNumber,
        plan.moduleTitle,
        lecture,
        syllabusChunks,
        referenceChunks
      )) {
        lectureMarkdown += chunk;
        send({ type: 'chunk', chunk });
      }

      fullMarkdown += lectureMarkdown + '\n\n---\n\n';

      // ✅ Save to disk after EVERY lecture so content is never lost
      saveMarkdownToDisk(subjectId, moduleNumber, fullMarkdown);

      send({ type: 'lecture_done', lectureNumber: lecture.lectureNumber });
    }

    // Generate PDF (skip if notes body never arrived)
    send({ type: 'pdf_generating' });
    try {
      if (fullMarkdown.trim().length < 80) {
        throw new Error('Notes content too short — PDF was not generated');
      }

      const pdfPath = await generateModulePdf(
        subjectId,
        subject.name,
        moduleNumber,
        plan.moduleTitle,
        fullMarkdown
      );
      console.log(`[aiController] PDF generated: ${pdfPath}`);
      send({
        type: 'pdf_ready',
        pdfUrl: `/api/v1/ai/subjects/${subjectId}/modules/${moduleNumber}/pdf`,
      });
    } catch (pdfErr: unknown) {
      const pdfMsg = pdfErr instanceof Error ? pdfErr.message : 'PDF generation failed';
      console.error('[aiController] PDF error (content saved to disk):', pdfMsg);
      // Don't fail the whole generation — markdown is saved, user can retry PDF
      send({ type: 'pdf_error', message: 'PDF generation failed — use the Download button to retry.' });
    }

    send({ type: 'done' });
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[aiController] Generation error:', message);
    send({ type: 'error', message });
    res.end();
  }
});

// ── GET /ai/subjects/:subjectId/modules/:moduleNum/pdf ────────────────────────

export const downloadModulePdf = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const pdfPath = getPdfPathIfExists(subjectId, moduleNumber);
  if (!pdfPath) {
    res.status(404).json({ error: 'PDF not yet generated for this module. Use POST to generate it.' });
    return;
  }

  const fileName = `${subject.short}_Module_${moduleNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  fs.createReadStream(pdfPath).pipe(res);
});

// ── POST /ai/subjects/:subjectId/modules/:moduleNum/pdf ───────────────────────
// Generate PDF on-demand from the saved markdown file (safe to call anytime)

export const regenerateModulePdf = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const markdown = loadMarkdownFromDisk(subjectId, moduleNumber);
  if (!markdown) {
    res.status(404).json({ error: 'No generated content found for this module. Please generate notes first.' });
    return;
  }

  try {
    const pdfPath = await generateModulePdf(
      subjectId,
      subject.name,
      moduleNumber,
      `Module ${moduleNumber}`,
      markdown
    );
    console.log(`[aiController] PDF regenerated: ${pdfPath}`);

    // Stream back directly
    const fileName = `${subject.short}_Module_${moduleNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    res.status(500).json({ error: message });
  }
});

// ── POST /ai/subjects/:subjectId/index ────────────────────────────────────────
// Re-index all files for a subject (useful after restart)

export const reindexSubject = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const subject = getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const files = getUploadedFiles(subjectId);
  let total = 0;

  const processFiles = async (docType: DocumentType, fileNames: string[]) => {
    for (const fileName of fileNames) {
      const filePath = getFullFilePath(subjectId, docType, fileName);
      const result = await indexSubjectFile(subjectId, filePath, docType);
      total += result.chunks;
    }
  };

  // Non-blocking
  Promise.all([
    processFiles('syllabus', files.syllabus),
    processFiles('reference', files.reference),
  ]).catch(err => console.error('[reindex] Error:', err));

  res.json({ data: { message: 'Re-indexing started', files } });
});
