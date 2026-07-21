// Extends Express Request with LMS-specific fields
declare global {
  namespace Express {
    interface Request {
      /** Generated resource UUID — set by multer destination callback or pre-middleware */
      resourceId?: string;
      /** subjectId resolved from the resource lookup for update routes */
      resourceSubjectId?: string;
    }
  }
}

export {};
