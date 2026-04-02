import { useState, useEffect } from 'react';

export function useShoppingItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shopping-list', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch shopping list');
      }

      const data = await response.json();
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shopping items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const addItem = async (itemData) => {
    try {
      const response = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(itemData)
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      const newItem = await response.json();
      setItems([newItem, ...items]);
      return newItem;
    } catch (err) {
      console.error('Failed to add item:', err);
      throw err;
    }
  };

  const updateItem = async (itemId, updates) => {
    try {
      const response = await fetch(`/api/shopping-list/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      const updatedItem = await response.json();
      setItems(items.map(item =>
        item.id === itemId ? updatedItem : item
      ));
      return updatedItem;
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const response = await fetch(`/api/shopping-list/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(items.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    }
  };

  const toggleChecked = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      const response = await fetch(`/api/shopping-list/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ checked: !item.checked })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle item');
      }

      const updatedItem = await response.json();
      setItems(items.map(i =>
        i.id === itemId ? updatedItem : i
      ));
    } catch (err) {
      console.error('Failed to toggle item:', err);
      throw err;
    }
  };

  const clearChecked = async () => {
    try {
      const response = await fetch('/api/shopping-list/clear-checked', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to clear checked items');
      }

      setItems(items.filter(item => !item.checked));
    } catch (err) {
      console.error('Failed to clear checked items:', err);
      throw err;
    }
  };

  const importCheckedToInventory = async () => {
    try {
      const response = await fetch('/api/shopping-list/add-checked-to-inventory', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to import items');
      }

      const result = await response.json();
      setItems(items.filter(item => !item.checked));
      return result;
    } catch (err) {
      console.error('Failed to import items:', err);
      throw err;
    }
  };

  const suggestLowStock = async () => {
    try {
      const response = await fetch('/api/shopping-list/suggest-low-stock', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to suggest items');
      }

      const result = await response.json();
      await fetchItems(); // Refresh the list
      return result;
    } catch (err) {
      console.error('Failed to suggest items:', err);
      throw err;
    }
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
    refetch: fetchItems
  };
}
