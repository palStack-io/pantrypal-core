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
        const raw = Array.isArray(data) ? data : ((data as any)?.locations ?? []);
        const names = raw.map((l: any) => (typeof l === 'string' ? l : l.name));
        setLocations([...names].sort((a: string, b: string) => a.localeCompare(b)));
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
            typeof c === 'string'
              ? { name: c, emoji: '📦' }
              : { id: c.id, name: c.name, emoji: c.emoji ?? '📦', user_defined: c.user_defined ?? false }
          );
          const sorted = [...objs].sort((a, b) => a.name.localeCompare(b.name));
          setCategoryObjects(sorted);
          setCategories(sorted.map(c => c.name));
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
