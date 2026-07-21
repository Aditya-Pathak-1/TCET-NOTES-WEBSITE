import { useState, useEffect, useCallback } from 'react';
import * as subjectApi from '../api/subjects';
import type { Subject, CreateSubjectDto, UpdateSubjectDto } from '../types';

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSubjects(await subjectApi.getSubjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const create = async (dto: CreateSubjectDto) => {
    const s = await subjectApi.createSubject(dto);
    setSubjects(prev => [s, ...prev]);
    return s;
  };

  const update = async (id: string, dto: UpdateSubjectDto) => {
    const s = await subjectApi.updateSubject(id, dto);
    setSubjects(prev => prev.map(x => (x.id === id ? s : x)));
    return s;
  };

  const remove = async (id: string) => {
    await subjectApi.deleteSubject(id);
    setSubjects(prev => prev.filter(x => x.id !== id));
  };

  return { subjects, loading, error, fetchSubjects, create, update, remove };
}
