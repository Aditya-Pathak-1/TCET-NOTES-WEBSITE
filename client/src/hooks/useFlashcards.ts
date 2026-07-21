import { useState, useEffect, useCallback } from 'react';
import * as flashcardApi from '../api/flashcards';
import type { Flashcard, CreateFlashcardDto, UpdateFlashcardDto } from '../types';

export function useFlashcards(resourceId: string | undefined) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!resourceId) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      setFlashcards(await flashcardApi.getFlashcards(resourceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (dto: CreateFlashcardDto) => {
    if (!resourceId) return;
    const f = await flashcardApi.createFlashcard(resourceId, dto);
    setFlashcards(prev => [...prev, f]);
    return f;
  };

  const update = async (id: string, dto: UpdateFlashcardDto) => {
    const f = await flashcardApi.updateFlashcard(id, dto);
    setFlashcards(prev => prev.map(x => (x.id === id ? f : x)));
    return f;
  };

  const remove = async (id: string) => {
    await flashcardApi.deleteFlashcard(id);
    setFlashcards(prev => prev.filter(x => x.id !== id));
  };

  return { flashcards, loading, error, refetch: fetch, create, update, remove };
}
