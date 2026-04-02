// Custom hook for managing locations and categories
import { useState, useEffect, useCallback } from 'react';
import { getLocations, getCategories } from '../api';
import { getDefaultLocations, getDefaultCategories } from '../defaults';

export function useLocations() {
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      try {
        const data = await getLocations();
        setLocations(Array.isArray(data) ? data : []);
      } catch (apiError) {
        console.warn('Using default locations:', apiError);
        setLocations(getDefaultLocations());
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
      setError(err.message || 'Failed to load locations');
      setLocations(getDefaultLocations());
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
        setCategories(Array.isArray(data) ? data : []);
      } catch (apiError) {
        console.warn('Using default categories:', apiError);
        setCategories(getDefaultCategories());
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err.message || 'Failed to load categories');
      setCategories(getDefaultCategories());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadLocations(), loadCategories()]);
  }, [loadLocations, loadCategories]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    locations,
    categories,
    loading,
    error,
    refresh: loadAll,
    refreshLocations: loadLocations,
    refreshCategories: loadCategories,
  };
}

export default useLocations;
