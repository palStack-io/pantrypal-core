import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getItems, createItem, updateItem, deleteItem } from '../api';
import type { Item } from '../types';

const PAGE_SIZE = 50;

export interface ItemFilters {
  location?: string;
  search?: string;
}

export interface UseItemsReturn {
  items: Item[];
  loading: boolean;
  error: string | null;
  filters: ItemFilters;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  addItem: (itemData: Partial<Item>) => Promise<Item>;
  editItem: (id: string | number, itemData: Partial<Item>) => Promise<Item>;
  removeItem: (id: string | number) => () => void;
  removeItems: (ids: (string | number)[]) => () => void;
  refresh: () => void;
  goToPage: (page: number) => void;
  updateFilters: (newFilters: Partial<ItemFilters>) => void;
  clearFilters: () => void;
}

export function useItems(initialFilters: ItemFilters = {}): UseItemsReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ItemFilters>(initialFilters);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

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
        setItems((data as { items: Item[]; total: number }).items);
        setTotal((data as { items: Item[]; total: number }).total);
      } else {
        const arr = Array.isArray(data) ? (data as Item[]) : [];
        setItems(arr);
        setTotal(arr.length);
      }
    } catch (err) {
      if (axios.isCancel(err) || (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))) return;
      const msg = err instanceof Error ? err.message : 'Failed to load items';
      setError(msg);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, page]);

  const addItem = async (itemData: Partial<Item>): Promise<Item> => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Item = { id: tempId, name: itemData.name || '', quantity: itemData.quantity || 1, ...itemData };
    setItems(prev => [...prev, optimistic]);
    setTotal(prev => prev + 1);
    try {
      const newItem = await createItem(itemData);
      setItems(prev => prev.map(item => item.id === tempId ? newItem : item));
      return newItem;
    } catch (err) {
      setItems(prev => prev.filter(item => item.id !== tempId));
      setTotal(prev => prev - 1);
      const msg = err instanceof Error ? err.message : 'Failed to add item';
      setError(msg);
      throw err;
    }
  };

  const editItem = async (id: string | number, itemData: Partial<Item>): Promise<Item> => {
    const snapshot = items.find(item => item.id === id);
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...itemData } : item));
    try {
      const updatedItem = await updateItem(id, itemData);
      setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      if (snapshot) setItems(prev => prev.map(item => item.id === id ? snapshot : item));
      const msg = err instanceof Error ? err.message : 'Failed to update item';
      setError(msg);
      throw err;
    }
  };

  const UNDO_DELAY_MS = 5000;

  const removeItems = (ids: (string | number)[]): () => void => {
    const idSet = new Set(ids.map(String));
    const snapshots = items.filter(item => idSet.has(String(item.id)));
    setItems(prev => prev.filter(item => !idSet.has(String(item.id))));
    setTotal(prev => Math.max(0, prev - ids.length));

    const restore = () => {
      setItems(prev => {
        const existing = new Set(prev.map(i => String(i.id)));
        return [...prev, ...snapshots.filter(s => !existing.has(String(s.id)))];
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
        const msg = err instanceof Error ? err.message : 'Failed to delete items';
        setError(msg);
      }
    }, UNDO_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      restore();
    };
  };

  const removeItem = (id: string | number): () => void => removeItems([id]);

  useEffect(() => {
    loadItems(page);
    return () => { abortRef.current?.abort(); };
  }, [filters, page]);

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
    goToPage: (newPage: number) => setPage(newPage),
    updateFilters: (newFilters: Partial<ItemFilters>) => { setPage(0); setFilters(prev => ({ ...prev, ...newFilters })); },
    clearFilters: () => { setPage(0); setFilters({}); },
  };
}

export default useItems;
