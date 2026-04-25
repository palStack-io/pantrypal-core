import { useState, useEffect, useCallback } from 'react';
import { getLocations, getCategories } from '../api';
import { getDefaultLocationNames, getDefaultCategoryNames } from '../defaults';

export interface UseLocationsReturn {
  locations: string[];
  categories: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export function useLocations(): UseLocationsReturn {
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      try {
        const data = await getLocations();
        setLocations(Array.isArray(data) ? data.map(l => (typeof l === 'string' ? l : l.name)) : []);
      } catch {
        setLocations(getDefaultLocationNames());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load locations';
      setError(msg);
      setLocations(getDefaultLocationNames());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      try {
        const data = await getCategories();
        setCategories(Array.isArray(data) ? data.map(c => (typeof c === 'string' ? c : c.name)) : []);
      } catch {
        setCategories(getDefaultCategoryNames());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
      setError(msg);
      setCategories(getDefaultCategoryNames());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadLocations(), loadCategories()]);
  }, [loadLocations, loadCategories]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return { locations, categories, loading, error, refresh: loadAll, refreshLocations: loadLocations, refreshCategories: loadCategories };
}

export default useLocations;
