import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '../db/database';
import { deletePath, UPLOADS_DIR } from '../utils/fileUtils';
import type { CreateResourceDto, UpdateResourceDto } from '../types';

export class ResourceService {
  async findBySubjectId(subjectId: string) {
    return prisma.resource.findMany({
      where: { subjectId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.resource.findUnique({ where: { id } });
  }

  async create(
    subjectId: string,
    dto: CreateResourceDto,
    file?: Express.Multer.File,
    resourceId?: string
  ) {
    const id = resourceId ?? uuidv4();
    const now = new Date().toISOString();
    return prisma.resource.create({
      data: {
        id,
        subjectId,
        title: dto.title,
        type: dto.type,
        fileName: file?.originalname ?? '',
        filePath: file ? `${subjectId}/${id}/${file.filename}` : '',
        fileSize: file?.size ?? 0,
        mimeType: file?.mimetype ?? '',
        uploadedAt: now,
        updatedAt: now,
        ownerId: null,
      },
    });
  }

  async update(id: string, dto: UpdateResourceDto, file?: Express.Multer.File) {
    const existing = await this.findById(id);
    if (!existing) return null;

    // Delete old file if a new one was uploaded (keep the directory)
    if (file && existing.filePath) {
      const parts = existing.filePath.split('/');
      deletePath(path.join(UPLOADS_DIR, ...parts));
    }

    return prisma.resource.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        fileName: file?.originalname ?? existing.fileName,
        filePath: file
          ? `${existing.subjectId}/${id}/${file.filename}`
          : existing.filePath,
        fileSize: file?.size ?? existing.fileSize,
        mimeType: file?.mimetype ?? existing.mimeType,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    const resource = await this.findById(id);
    if (!resource) return false;
    // Delete the entire resource directory from disk
    deletePath(path.join(UPLOADS_DIR, resource.subjectId, id));
    try {
      await prisma.resource.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /** Resolves DB filePath (forward-slash segments) to an absolute filesystem path */
  getAbsoluteFilePath(resource: { filePath: string }): string {
    return path.join(UPLOADS_DIR, ...resource.filePath.split('/'));
  }
}

export const resourceService = new ResourceService();
