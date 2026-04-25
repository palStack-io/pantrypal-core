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

export function useShoppingItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

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
      if (axios.isCancel(err) || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to fetch shopping list');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    return () => { abortRef.current?.abort(); };
  }, []);

  const addItem = async (itemData) => {
    const newItem = await addShoppingItem(itemData);
    setItems((prev) => [newItem, ...prev]);
    return newItem;
  };

  const updateItem = async (itemId, updates) => {
    const updatedItem = await updateShoppingItem(itemId, updates);
    setItems((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
    return updatedItem;
  };

  const UNDO_DELAY_MS = 5000;

  const deleteItem = (itemId) => {
    const snapshot = items.find(item => item.id === itemId);
    setItems(prev => prev.filter(item => item.id !== itemId));

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await deleteShoppingItem(itemId);
      } catch (_err) {
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

  const toggleChecked = async (itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updatedItem = await updateShoppingItem(itemId, { checked: !item.checked });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
  };

  const clearChecked = () => {
    const checked = items.filter(item => item.checked);
    setItems(prev => prev.filter(item => !item.checked));

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await clearCheckedShoppingItems();
      } catch (_err) {
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

  const importCheckedToInventory = async () => {
    const result = await apiImportChecked();
    setItems((prev) => prev.filter((item) => !item.checked));
    return result;
  };

  const suggestLowStock = async () => {
    const result = await apiSuggestLowStock();
    await fetchItems();
    return result;
  };

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    toggleChecked,
    clearChecked,
    importCheckedToInventory,
    suggestLowStock,
    refetch: fetchItems,
  };
}
