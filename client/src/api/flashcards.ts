import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Flashcard, CreateFlashcardDto, UpdateFlashcardDto } from '../types';

export const getFlashcards = (resourceId: string) =>
  apiGet<Flashcard[]>(`/resources/${resourceId}/flashcards`);

export const createFlashcard = (resourceId: string, dto: CreateFlashcardDto) =>
  apiPost<Flashcard>(`/resources/${resourceId}/flashcards`, dto);

export const updateFlashcard = (id: string, dto: UpdateFlashcardDto) =>
  apiPut<Flashcard>(`/flashcards/${id}`, dto);

export const deleteFlashcard = (id: string) =>
  apiDelete(`/flashcards/${id}`);
