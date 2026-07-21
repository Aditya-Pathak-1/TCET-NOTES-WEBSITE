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
        description: dto.description ?? null,
        color: dto.color ?? '#6366f1',
        icon: dto.icon ?? '📚',
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
      return true;
    } catch {
      return false;
    }
  }
}

export const subjectService = new SubjectService();
