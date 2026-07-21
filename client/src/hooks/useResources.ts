import { useState, useEffect, useCallback } from 'react';
import * as resourceApi from '../api/resources';
import type { Resource, ResourceType } from '../types';

export function useResources(subjectId: string | undefined) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!subjectId) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      setResources(await resourceApi.getResources(subjectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (title: string, type: ResourceType, file?: File) => {
    if (!subjectId) return;
    const r = await resourceApi.createResource(subjectId, title, type, file);
    setResources(prev => [r, ...prev]);
    return r;
  };

  const update = async (id: string, title: string, file?: File) => {
    const r = await resourceApi.updateResource(id, title, file);
    setResources(prev => prev.map(x => (x.id === id ? r : x)));
    return r;
  };

  const remove = async (id: string) => {
    await resourceApi.deleteResource(id);
    setResources(prev => prev.filter(x => x.id !== id));
  };

  return { resources, loading, error, refetch: fetch, create, update, remove };
}
