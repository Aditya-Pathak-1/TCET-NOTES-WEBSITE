import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './errorHandler';
import prisma from '../db/database';

/**
 * Pre-multer middleware for PUT /resources/:id.
 * Looks up the resource to get its subjectId, then sets:
 *   req.resourceId        = req.params.id
 *   req.resourceSubjectId = resource.subjectId
 *
 * This runs (async, fully resolved) before multer's synchronous
 * destination callback, so multer can determine the upload path
 * without making its own DB call.
 */
export const attachResource = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      select: { subjectId: true },
    });
    if (!resource) {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
    req.resourceId = req.params.id;
    req.resourceSubjectId = resource.subjectId;
    next();
  }
);
