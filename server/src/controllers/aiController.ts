/**
 * aiController.ts
 * ───────────────
 * All AI Notes Generator API endpoints.
 *
 * GET  /ai/subjects                                    — list 6 fixed subjects
 * GET  /ai/subjects/:subjectId/status                  — upload status + docx status
 * POST /ai/subjects/:subjectId/upload                  — upload syllabus or reference book
 * DELETE /ai/subjects/:subjectId/files/:docType/:name  — delete a file
 * POST /ai/subjects/:subjectId/modules/:moduleNum/plan — plan lectures for a module
 * POST /ai/subjects/:subjectId/modules/:moduleNum/generate — SSE: stream module notes
 * GET  /ai/subjects/:subjectId/modules/:moduleNum/docx  — download generated DOCX
 * POST /ai/subjects/:subjectId/modules/:moduleNum/docx  — generate DOCX from saved markdown
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
import { planModule, generateLecture, verifyDocumentRelevance } from '../services/llmService';
import type { ContextChunk } from '../services/llmService';
import {
  generateModuleDocx,
  getDocxStatus,
  getDocxPathIfExists,
  deleteDocx,
} from '../services/wordGenerator';
import {
  generateModulePptx,
  getPptxStatus,
  getPptxPathIfExists,
  deletePptx,
} from '../services/pptGenerator';
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
  res.json({ data: await getAllSubjects() });
});

// ── GET /ai/subjects/:subjectId/status ────────────────────────────────────────

export const getSubjectStatus = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const subject = await getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const files = getUploadedFiles(subjectId);
  const docxStatus = getDocxStatus(subjectId);
  const pptxStatus = getPptxStatus(subjectId);

  res.json({
    data: {
      subject,
      files,
      docxStatus,
      pptxStatus,
      hasSyllabus: files.syllabus.length > 0,
      hasReference: files.reference.length > 0,
    },
  });
});

// ── POST /ai/subjects/:subjectId/upload ───────────────────────────────────────

export const uploadSubjectFile = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const docType = (req.body.docType ?? 'reference') as DocumentType;

  const subject = await getSubjectById(subjectId);
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

  // Verify document relevance before indexing
  try {
    const text = await extractText(filePath);
    if (text && text.trim().length > 50) {
      const verification = await verifyDocumentRelevance(text, subject.name, docType);
      if (!verification.isValid) {
        fs.unlinkSync(filePath); // Delete invalid file
        res.status(400).json({ error: `Upload rejected: ${verification.reason}` });
        return;
      }
    }
  } catch (err) {
    console.error('[upload] Verification failed, proceeding anyway:', err);
  }

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

  const subject = await getSubjectById(subjectId);
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

  const subject = await getSubjectById(subjectId);
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
 *   { type: 'docx_ready', docxUrl }
 *   { type: 'done' }
 *   { type: 'error', message }
 */
export const generateModuleNotes = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);
  const { plan } = req.body as { plan: import('../services/llmService').ModulePlan };

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }
  if (!plan || !plan.lectures || plan.lectures.length === 0) {
    res.status(400).json({ error: 'plan with lectures is required in request body' });
    return;
  }

  // Delete existing DOCX and PPTX so they regenerate fresh
  deleteDocx(subjectId, moduleNumber);
  deletePptx(subjectId, moduleNumber);

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

    // Generate DOCX (skip if notes body never arrived)
    send({ type: 'docx_generating' });
    try {
      if (fullMarkdown.trim().length < 80) {
        throw new Error('Notes content too short — DOCX was not generated');
      }

      const docxPath = await generateModuleDocx(
        subjectId,
        subject.name,
        moduleNumber,
        plan.moduleTitle,
        fullMarkdown
      );
      console.log(`[aiController] DOCX generated: ${docxPath}`);
      send({
        type: 'docx_ready',
        docxUrl: `/api/v1/ai/subjects/${subjectId}/modules/${moduleNumber}/docx`,
      });
    } catch (docxErr: unknown) {
      const docxMsg = docxErr instanceof Error ? docxErr.message : 'DOCX generation failed';
      console.error('[aiController] DOCX error (content saved to disk):', docxMsg);
      // Don't fail the whole generation — markdown is saved, user can retry DOCX
      send({ type: 'docx_error', message: 'DOCX generation failed — use the Download button to retry.' });
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

// ── GET /ai/subjects/:subjectId/modules/:moduleNum/docx ────────────────────────

export const downloadModuleDocx = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const docxPath = getDocxPathIfExists(subjectId, moduleNumber);
  if (!docxPath) {
    res.status(404).json({ error: 'DOCX not yet generated for this module. Use POST to generate it.' });
    return;
  }

  const fileName = `${subject.short}_Module_${moduleNumber}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  fs.createReadStream(docxPath).pipe(res);
});

// ── POST /ai/subjects/:subjectId/modules/:moduleNum/docx ───────────────────────
// Generate DOCX on-demand from the saved markdown file (safe to call anytime)

export const regenerateModuleDocx = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = await getSubjectById(subjectId);
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
    const docxPath = await generateModuleDocx(
      subjectId,
      subject.name,
      moduleNumber,
      `Module ${moduleNumber}`,
      markdown
    );
    console.log(`[aiController] DOCX regenerated: ${docxPath}`);

    // Stream back directly
    const fileName = `${subject.short}_Module_${moduleNumber}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(docxPath).pipe(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DOCX generation failed';
    res.status(500).json({ error: message });
  }
});

// ── GET /ai/subjects/:subjectId/modules/:moduleNum/pptx ────────────────────────

export const downloadModulePptx = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const pptxPath = getPptxPathIfExists(subjectId, moduleNumber);
  if (!pptxPath) {
    res.status(404).json({ error: 'PPTX not yet generated for this module.' });
    return;
  }

  const fileName = `${subject.short}_Module_${moduleNumber}.pptx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  fs.createReadStream(pptxPath).pipe(res);
});

// ── POST /ai/subjects/:subjectId/modules/:moduleNum/pptx ───────────────────────

export const regenerateModulePptx = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, moduleNum } = req.params;
  const moduleNumber = parseInt(moduleNum, 10);

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const markdown = loadMarkdownFromDisk(subjectId, moduleNumber);
  if (!markdown) {
    res.status(404).json({ error: 'No generated content found for this module.' });
    return;
  }

  try {
    const pptxPath = await generateModulePptx(
      subjectId,
      subject.name,
      moduleNumber,
      `Module ${moduleNumber}`,
      markdown
    );
    
    const fileName = `${subject.short}_Module_${moduleNumber}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(pptxPath).pipe(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PPTX generation failed';
    res.status(500).json({ error: message });
  }
});
// Re-index all files for a subject (useful after restart)

export const reindexSubject = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const subject = await getSubjectById(subjectId);
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
