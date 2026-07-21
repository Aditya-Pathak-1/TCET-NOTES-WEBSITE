import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/database';
import type { CreateFlashcardDto, UpdateFlashcardDto } from '../types';

export class FlashcardService {
  async findByDeckId(deckResourceId: string) {
    return prisma.flashcard.findMany({
      where: { deckResourceId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.flashcard.findUnique({ where: { id } });
  }

  async create(deckResourceId: string, dto: CreateFlashcardDto) {
    // Compute next sort order
    const agg = await prisma.flashcard.aggregate({
      where: { deckResourceId },
      _max: { sortOrder: true },
    });
    const nextOrder = dto.order ?? (agg._max.sortOrder !== null ? agg._max.sortOrder + 1 : 0);

    return prisma.flashcard.create({
      data: {
        id: uuidv4(),
        deckResourceId,
        question: dto.question,
        answer: dto.answer,
        sortOrder: nextOrder,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async update(id: string, dto: UpdateFlashcardDto) {
    const existing = await this.findById(id);
    if (!existing) return null;
    return prisma.flashcard.update({
      where: { id },
      data: {
        question: dto.question ?? existing.question,
        answer: dto.answer ?? existing.answer,
        sortOrder: dto.order ?? existing.sortOrder,
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.flashcard.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

export const flashcardService = new FlashcardService();
