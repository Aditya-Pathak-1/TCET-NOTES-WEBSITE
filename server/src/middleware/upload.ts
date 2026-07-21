import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_DIR } from '../utils/fileUtils';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '52428800', 10); // 50 MB default

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
]);

/**
 * Resolves the subject ID for file path construction:
 *  POST /subjects/:subjectId/resources → req.params.subjectId
 *  PUT  /resources/:id                 → req.resourceSubjectId (set by attachResource middleware)
 */
function resolveSubjectId(req: Express.Request & { params: Record<string, string> }): string {
  return req.params.subjectId ?? req.resourceSubjectId ?? 'unknown';
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const typedReq = req as Express.Request & { params: Record<string, string> };
    const subjectId = resolveSubjectId(typedReq);

    // For creates: generate a new UUID; for updates: req.resourceId is set by attachResource
    if (!req.resourceId) {
      req.resourceId = uuidv4();
    }

    const uploadPath = path.join(UPLOADS_DIR, subjectId, req.resourceId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^\w.\-]/g, '_')
      .substring(0, 100);
    cb(null, `${base}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
