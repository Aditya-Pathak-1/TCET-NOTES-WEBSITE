/**
 * ai.ts (routes)
 * ──────────────
 * All AI University Notes Generator endpoints under /api/v1/ai/
 */

import { Router } from 'express';
import multer from 'multer';
import * as aiCtrl from '../controllers/aiController';

const router = Router();

// Use memoryStorage so we can pass buffer to saveUploadedFile
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Fixed subjects list
router.get('/subjects', aiCtrl.getSubjects);

// Per-subject status (uploaded files + pdf ready status)
router.get('/subjects/:subjectId/status', aiCtrl.getSubjectStatus);

// File upload for a subject
router.post('/subjects/:subjectId/upload', upload.single('file'), aiCtrl.uploadSubjectFile);

// Delete a file
router.delete('/subjects/:subjectId/files/:docType/:fileName', aiCtrl.deleteSubjectFile);

// Re-index all files for a subject
router.post('/subjects/:subjectId/index', aiCtrl.reindexSubject);

// Plan lectures for a module (returns JSON lecture plan)
router.post('/subjects/:subjectId/modules/:moduleNum/plan', aiCtrl.planModuleNotes);

// Generate full module notes via SSE streaming
router.post('/subjects/:subjectId/modules/:moduleNum/generate', aiCtrl.generateModuleNotes);

// Download generated PDF
router.get('/subjects/:subjectId/modules/:moduleNum/pdf', aiCtrl.downloadModulePdf);

// Generate PDF on-demand from saved markdown (works even if SSE pdf step failed)
router.post('/subjects/:subjectId/modules/:moduleNum/pdf', aiCtrl.regenerateModulePdf);

export default router;
