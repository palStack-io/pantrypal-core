import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  getShoppingList,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
  clearCheckedShoppingItems,
  importCheckedToInventory as apiImportChecked,
  suggestLowStock as apiSuggestLowStock,
} from '../api';
import type { ShoppingItem } from '../types';

export interface UseShoppingItemsReturn {
  items: ShoppingItem[];
  loading: boolean;
  error: string | null;
  addItem: (itemData: Partial<ShoppingItem>) => Promise<ShoppingItem>;
  updateItem: (itemId: string | number, updates: Partial<ShoppingItem>) => Promise<ShoppingItem>;
  deleteItem: (itemId: string | number) => () => void;
  toggleChecked: (itemId: string | number) => Promise<void>;
  clearChecked: () => () => void;
  importCheckedToInventory: () => Promise<unknown>;
  suggestLowStock: () => Promise<unknown>;
  refetch: () => Promise<void>;
}

export function useShoppingItems(): UseShoppingItemsReturn {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchItems = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      const data = await getShoppingList(controller.signal);
      setItems(data);
      setError(null);
    } catch (err) {
      if (axios.isCancel(err) || (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch shopping list');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    return () => { abortRef.current?.abort(); };
  }, []);

  const addItem = async (itemData: Partial<ShoppingItem>): Promise<ShoppingItem> => {
    const newItem = await addShoppingItem(itemData);
    setItems(prev => [newItem, ...prev]);
    return newItem;
  };

  const updateItem = async (itemId: string | number, updates: Partial<ShoppingItem>): Promise<ShoppingItem> => {
    const updatedItem = await updateShoppingItem(itemId, updates);
    setItems(prev => prev.map(item => item.id === itemId ? updatedItem : item));
    return updatedItem;
  };

  const UNDO_DELAY_MS = 5000;

  const deleteItem = (itemId: string | number): () => void => {
    const snapshot = items.find(item => item.id === itemId);
    setItems(prev => prev.filter(item => item.id !== itemId));

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await deleteShoppingItem(itemId);
      } catch {
        if (snapshot) setItems(prev => {
          const existing = new Set(prev.map(i => i.id));
          return existing.has(itemId) ? prev : [...prev, snapshot];
        });
      }
    }, UNDO_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (snapshot) setItems(prev => {
        const existing = new Set(prev.map(i => i.id));
        return existing.has(itemId) ? prev : [...prev, snapshot];
      });
    };
  };

  const toggleChecked = async (itemId: string | number): Promise<void> => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const updatedItem = await updateShoppingItem(itemId, { checked: !item.checked });
    setItems(prev => prev.map(i => i.id === itemId ? updatedItem : i));
  };

  const clearChecked = (): () => void => {
    const checked = items.filter(item => item.checked);
    setItems(prev => prev.filter(item => !item.checked));

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await clearCheckedShoppingItems();
      } catch {
        setItems(prev => {
          const existing = new Set(prev.map(i => i.id));
          return [...prev, ...checked.filter(c => !existing.has(c.id))];
        });
      }
    }, UNDO_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setItems(prev => {
        const existing = new Set(prev.map(i => i.id));
        return [...prev, ...checked.filter(c => !existing.has(c.id))];
      });
    };
  };

  const importCheckedToInventory = async (): Promise<unknown> => {
    const result = await apiImportChecked();
    setItems(prev => prev.filter(item => !item.checked));
    return result;
  };

  const suggestLowStock = async (): Promise<unknown> => {
    const result = await apiSuggestLowStock();
    await fetchItems();
    return result;
  };

  return { items, loading, error, addItem, updateItem, deleteItem, toggleChecked, clearChecked, importCheckedToInventory, suggestLowStock, refetch: fetchItems };
}
