import { useState, useCallback, useRef } from 'react';
import { search as searchApi } from '../api/search';
import type { SearchResult } from '../types';

export function useSearch() {
  const [results, setResults]   = useState<SearchResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [query, setQuery]       = useState('');
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      setResults(await searchApi(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const onQueryChange = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 350);
  }, [doSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { query, results, loading, error, onQueryChange, clear, doSearch };
}
