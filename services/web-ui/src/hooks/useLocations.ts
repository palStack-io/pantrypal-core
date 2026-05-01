import { useState, useEffect, useCallback } from 'react';
import { getLocations, getCategories } from '../api';
import { getDefaultLocationNames, getDefaultCategories, getDefaultCategoryNames } from '../defaults';
import type { CategoryOption } from '../types';

export interface UseLocationsReturn {
  locations: string[];
  categories: string[];
  categoryObjects: CategoryOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export function useLocations(): UseLocationsReturn {
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryObjects, setCategoryObjects] = useState<CategoryOption[]>([]);
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
        if (Array.isArray(data) && data.length > 0) {
          const objs: CategoryOption[] = data.map(c =>
            typeof c === 'string' ? { name: c, emoji: '📦' } : { name: c.name, emoji: c.emoji ?? '📦' }
          );
          setCategoryObjects(objs);
          setCategories(objs.map(c => c.name));
        } else {
          const defaults = getDefaultCategories();
          setCategoryObjects(defaults);
          setCategories(defaults.map(c => c.name));
        }
      } catch {
        const defaults = getDefaultCategories();
        setCategoryObjects(defaults);
        setCategories(getDefaultCategoryNames());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
      setError(msg);
      const defaults = getDefaultCategories();
      setCategoryObjects(defaults);
      setCategories(getDefaultCategoryNames());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadLocations(), loadCategories()]);
  }, [loadLocations, loadCategories]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return { locations, categories, categoryObjects, loading, error, refresh: loadAll, refreshLocations: loadLocations, refreshCategories: loadCategories };
}

export default useLocations;
