// Custom hook for managing inventory items
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getItems, createItem, updateItem, deleteItem } from '../api';

const PAGE_SIZE = 50;

export function useItems(initialFilters = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef(null);

  const loadItems = useCallback(async (targetPage = page) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const offset = targetPage * PAGE_SIZE;
      const data = await getItems(filters.location || null, filters.search || null, PAGE_SIZE, offset, controller.signal);
      if (data && typeof data === 'object' && 'items' in data) {
        setItems(data.items);
        setTotal(data.total);
      } else {
        setItems(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'AbortError' || err.name === 'CanceledError') return;
      console.error('Failed to load items:', err);
      setError(err.message || 'Failed to load items');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, page]);

  const addItem = async (itemData) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, ...itemData };
    setItems(prev => [...prev, optimistic]);
    setTotal(prev => prev + 1);
    try {
      const newItem = await createItem(itemData);
      setItems(prev => prev.map(item => item.id === tempId ? newItem : item));
      return newItem;
    } catch (err) {
      setItems(prev => prev.filter(item => item.id !== tempId));
      setTotal(prev => prev - 1);
      setError(err.message || 'Failed to add item');
      throw err;
    }
  };

  const editItem = async (id, itemData) => {
    const snapshot = items.find(item => item.id === id);
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...itemData } : item));
    try {
      const updatedItem = await updateItem(id, itemData);
      setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      if (snapshot) setItems(prev => prev.map(item => item.id === id ? snapshot : item));
      setError(err.message || 'Failed to update item');
      throw err;
    }
  };

  const UNDO_DELAY_MS = 5000;

  const removeItems = (ids) => {
    const idSet = new Set(ids);
    const snapshots = items.filter(item => idSet.has(item.id));
    setItems(prev => prev.filter(item => !idSet.has(item.id)));
    setTotal(prev => Math.max(0, prev - ids.length));

    const restore = () => {
      setItems(prev => {
        const existing = new Set(prev.map(i => i.id));
        return [...prev, ...snapshots.filter(s => !existing.has(s.id))];
      });
      setTotal(prev => prev + snapshots.length);
    };

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await Promise.all(ids.map(id => deleteItem(id)));
      } catch (err) {
        restore();
        setError(err.message || 'Failed to delete items');
      }
    }, UNDO_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      restore();
    };
  };

  const removeItem = (id) => removeItems([id]);

  useEffect(() => {
    loadItems(page);
    return () => { abortRef.current?.abort(); };
  }, [filters, page]);

  const goToPage = (newPage) => {
    setPage(newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return {
    items,
    loading,
    error,
    filters,
    page,
    totalPages,
    total,
    pageSize: PAGE_SIZE,
    addItem,
    editItem,
    removeItem,
    removeItems,
    refresh: () => loadItems(page),
    goToPage,
    updateFilters: (newFilters) => {
      setPage(0);
      setFilters(prev => ({ ...prev, ...newFilters }));
    },
    clearFilters: () => {
      setPage(0);
      setFilters({});
    },
  };
}

export default useItems;
