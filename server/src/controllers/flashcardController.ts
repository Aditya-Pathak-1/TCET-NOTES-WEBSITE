import { asyncHandler } from '../middleware/errorHandler';
import { flashcardService } from '../services/flashcardService';
import { resourceService } from '../services/resourceService';
import type { CreateFlashcardDto } from '../types';

export const getFlashcards = asyncHandler(async (req, res) => {
  const resource = await resourceService.findById(req.params.id);
  if (!resource) { res.status(404).json({ error: 'Resource not found' }); return; }
  res.json({ data: await flashcardService.findByDeckId(req.params.id) });
});

export const createFlashcard = asyncHandler(async (req, res) => {
  const { question, answer, order } = req.body as Partial<CreateFlashcardDto> & { order?: number };
  if (!question?.trim()) { res.status(400).json({ error: 'question is required' }); return; }
  if (!answer?.trim()) { res.status(400).json({ error: 'answer is required' }); return; }
  const resource = await resourceService.findById(req.params.id);
  if (!resource) { res.status(404).json({ error: 'Resource not found' }); return; }
  res.status(201).json({
    data: await flashcardService.create(req.params.id, {
      question: question.trim(),
      answer: answer.trim(),
      order,
    }),
  });
});

export const updateFlashcard = asyncHandler(async (req, res) => {
  const flashcard = await flashcardService.update(req.params.id, req.body);
  if (!flashcard) { res.status(404).json({ error: 'Flashcard not found' }); return; }
  res.json({ data: flashcard });
});

export const deleteFlashcard = asyncHandler(async (req, res) => {
  const deleted = await flashcardService.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Flashcard not found' }); return; }
  res.status(204).send();
});
