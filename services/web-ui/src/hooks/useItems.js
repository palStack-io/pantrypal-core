// Custom hook for managing inventory items
import { useState, useEffect, useCallback } from 'react';
import { getItems, createItem, updateItem, deleteItem } from '../api';

export function useItems(initialFilters = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getItems(filters.location || null, filters.search || null);
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const addItem = async (itemData) => {
    try {
      setLoading(true);
      const newItem = await createItem(itemData);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err.message || 'Failed to add item');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const editItem = async (id, itemData) => {
    try {
      setLoading(true);
      const updatedItem = await updateItem(id, itemData);
      setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err.message || 'Failed to update item');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (id) => {
    try {
      setLoading(true);
      await deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete item');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItems = async (ids) => {
    try {
      setLoading(true);
      await Promise.all(ids.map(id => deleteItem(id)));
      setItems(prev => prev.filter(item => !ids.includes(item.id)));
    } catch (err) {
      setError(err.message || 'Failed to delete items');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return {
    items,
    loading,
    error,
    filters,
    addItem,
    editItem,
    removeItem,
    removeItems,
    refresh: loadItems,
    updateFilters: (newFilters) => setFilters(prev => ({ ...prev, ...newFilters })),
    clearFilters: () => setFilters({}),
  };
}

export default useItems;
