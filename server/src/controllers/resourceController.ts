import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../middleware/errorHandler';
import { resourceService } from '../services/resourceService';
import type { CreateResourceDto } from '../types';
import prisma from '../db/database';

const DATASET_DIR = path.resolve(process.env.DATASET_PATH ?? './dataset');

export const getResources = asyncHandler(async (req, res) => {
  res.json({ data: await resourceService.findBySubjectId(req.params.subjectId) });
});

export const getResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.findById(req.params.id);
  if (!resource) { res.status(404).json({ error: 'Resource not found' }); return; }
  res.json({ data: resource });
});

export const createResource = asyncHandler(async (req, res) => {
  const { title, type } = req.body as Partial<CreateResourceDto>;
  if (!title?.trim()) { res.status(400).json({ error: 'title is required' }); return; }
  if (!type) { res.status(400).json({ error: 'type is required' }); return; }
  const resource = await resourceService.create(
    req.params.subjectId,
    { title: title.trim(), type },
    req.file,
    req.resourceId
  );
  res.status(201).json({ data: resource });

  // Sync to dataset folder for AI Notes
  if (req.file) {
    try {
      const subject = await prisma.subject.findUnique({ where: { id: req.params.subjectId } });
      if (subject) {
        const targetDir = path.join(DATASET_DIR, subject.name, resource.title);
        fs.mkdirSync(targetDir, { recursive: true });
        const sourcePath = resourceService.getAbsoluteFilePath(resource);
        fs.copyFileSync(sourcePath, path.join(targetDir, resource.fileName));
      }
    } catch (err) {
      console.error('[dataset-sync] Failed to copy created resource to dataset:', err);
    }
  }
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.update(req.params.id, req.body, req.file);
  if (!resource) { res.status(404).json({ error: 'Resource not found' }); return; }
  res.json({ data: resource });

  // Sync updated file to dataset folder
  if (req.file) {
    try {
      const subject = await prisma.subject.findUnique({ where: { id: resource.subjectId } });
      if (subject) {
        const targetDir = path.join(DATASET_DIR, subject.name, resource.title);
        // Clear existing files in this module folder to avoid duplicates
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });
        const sourcePath = resourceService.getAbsoluteFilePath(resource);
        fs.copyFileSync(sourcePath, path.join(targetDir, resource.fileName));
      }
    } catch (err) {
      console.error('[dataset-sync] Failed to sync updated resource to dataset:', err);
    }
  }
});

export const deleteResource = asyncHandler(async (req, res) => {
  // Remove from dataset folder
  try {
    const resource = await resourceService.findById(req.params.id);
    if (resource) {
      const subject = await prisma.subject.findUnique({ where: { id: resource.subjectId } });
      if (subject) {
        const targetDir = path.join(DATASET_DIR, subject.name, resource.title);
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
      }
    }
  } catch (err) {
    console.error('[dataset-sync] Failed to delete resource from dataset:', err);
  }

  const deleted = await resourceService.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Resource not found' }); return; }
  res.status(204).send();
});

export const downloadResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.findById(req.params.id);
  if (!resource?.filePath) { res.status(404).json({ error: 'Resource not found' }); return; }
  const abs = resourceService.getAbsoluteFilePath(resource);
  if (!fs.existsSync(abs)) { res.status(404).json({ error: 'File not found on disk' }); return; }
  res.download(abs, resource.fileName);
});

export const viewResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.findById(req.params.id);
  if (!resource?.filePath) { res.status(404).json({ error: 'Resource not found' }); return; }
  const abs = resourceService.getAbsoluteFilePath(resource);
  if (!fs.existsSync(abs)) { res.status(404).json({ error: 'File not found on disk' }); return; }
  res.setHeader('Content-Type', resource.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.fileName)}"`);
  fs.createReadStream(abs).pipe(res);
});
