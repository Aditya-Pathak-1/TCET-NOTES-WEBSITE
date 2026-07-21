import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { subjectService } from '../services/subjectService';

export const getSubjects = asyncHandler(async (_req, res) => {
  res.json({ data: await subjectService.findAll() });
});

export const getSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.findById(req.params.id);
  if (!subject) { res.status(404).json({ error: 'Subject not found' }); return; }
  res.json({ data: subject });
});

export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, color, icon } = req.body as {
    name?: string; description?: string; color?: string; icon?: string;
  };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  res.status(201).json({
    data: await subjectService.create({ name: name.trim(), description, color, icon }),
  });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.update(req.params.id, req.body);
  if (!subject) { res.status(404).json({ error: 'Subject not found' }); return; }
  res.json({ data: subject });
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const deleted = await subjectService.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Subject not found' }); return; }
  res.status(204).send();
});
