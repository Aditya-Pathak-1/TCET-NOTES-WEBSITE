import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/database';
import type { CreateSubjectDto, UpdateSubjectDto } from '../types';

export class SubjectService {
  async findAll() {
    return prisma.subject.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return prisma.subject.findUnique({ where: { id } });
  }

  async create(dto: CreateSubjectDto) {
    const now = new Date().toISOString();
    return prisma.subject.create({
      data: {
        id: uuidv4(),
        name: dto.name,
        short: dto.short ?? dto.name.substring(0, 4).toUpperCase(),
        description: dto.description ?? null,
        color: dto.color ?? '#6366f1',
        icon: dto.icon ?? '📚',
        totalModules: dto.totalModules ?? 6,
        subjectType: 'custom',
        createdAt: now,
        updatedAt: now,
        ownerId: null,
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const existing = await this.findById(id);
    if (!existing) return null;
    return prisma.subject.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        color: dto.color ?? existing.color,
        icon: dto.icon ?? existing.icon,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.subject.delete({ where: { id } });

      // Clean up files synchronously or asynchronously without failing the DB delete
      try {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.resolve(`./uploads/${id}`);
        const dataDir = path.resolve(`./data/markdown/${id}`);
        const wordDir = path.resolve(`./data/word/${id}`);
        const pptDir = path.resolve(`./data/ppt/${id}`);

        if (fs.existsSync(uploadsDir)) fs.rmSync(uploadsDir, { recursive: true, force: true });
        if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
        if (fs.existsSync(wordDir)) fs.rmSync(wordDir, { recursive: true, force: true });
        if (fs.existsSync(pptDir)) fs.rmSync(pptDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[subjectService] Failed to clean up files for subject ${id}:`, err);
      }

      return true;
    } catch {
      return false;
    }
  }
}

export const subjectService = new SubjectService();
