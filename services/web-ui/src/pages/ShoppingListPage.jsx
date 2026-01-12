import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, CheckSquare, Package } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useShoppingItems } from '../hooks/useShoppingItems';
import LoadingSpinner from '../components/LoadingSpinner';

export function ShoppingListPage({ isDark }) {
  const colors = getColors(isDark);
  const {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    toggleChecked,
    clearChecked,
    importCheckedToInventory,
    suggestLowStock
  } = useShoppingItems();

  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [groupBy, setGroupBy] = useState('none');
  const [alert, setAlert] = useState(null);

  const stats = {
    total: items.length,
    checked: items.filter(item => item.checked).length,
    remaining: items.filter(item => !item.checked).length
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await addItem({
        name: newItemName.trim(),
        quantity: newItemQuantity,
        category: 'Uncategorized'
      });
      setNewItemName('');
      setNewItemQuantity(1);
      showAlert('Item added to shopping list');
    } catch (err) {
      showAlert('Failed to add item', 'error');
    }
  };

  const handleImportChecked = async () => {
    try {
      const result = await importCheckedToInventory();
      showAlert(`Added ${result.added_count} items to inventory`);
    } catch (err) {
      showAlert('Failed to import items', 'error');
    }
  };

  const handleSuggestLowStock = async () => {
    try {
      const result = await suggestLowStock();
      showAlert(`Added ${result.added_count} items to shopping list`);
    } catch (err) {
      showAlert('Failed to suggest items', 'error');
    }
  };

  const handleClearChecked = async () => {
    if (!window.confirm('Clear all checked items?')) return;
    try {
      await clearChecked();
      showAlert('Checked items cleared');
    } catch (err) {
      showAlert('Failed to clear items', 'error');
    }
  };

  const groupedItems = groupBy === 'category'
    ? items.reduce((groups, item) => {
        const key = item.category || 'Uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
        return groups;
      }, {})
    : { 'All Items': items };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: '32px', backgroundColor: colors.background, minHeight: '100vh' }}>
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 24px',
          borderRadius: borderRadius.lg,
          background: alert.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${alert.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: alert.type === 'error' ? '#dc2626' : '#16a34a',
          fontWeight: '600',
          zIndex: 1000,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}>
          {alert.message}
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShoppingCart size={36} />
              Shopping List
            </h1>
            <p style={{ color: colors.textSecondary, marginTop: '8px' }}>
              {stats.remaining} items remaining • {stats.checked} checked
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
          <div style={{ background: colors.cardBackground, borderRadius: borderRadius.xl, padding: '32px', border: `1px solid ${colors.border}` }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>
                Items
              </h2>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <option value="none">No Grouping</option>
                <option value="category">Group by Category</option>
              </select>
            </div>

            <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add new item..."
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  background: colors.background,
                  border: `2px solid ${colors.border}`,
                  borderRadius: borderRadius.lg,
                  fontSize: '15px',
                  color: colors.textPrimary
                }}
              />
              <input
                type="number"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                min="1"
                style={{
                  width: '80px',
                  padding: '14px',
                  background: colors.background,
                  border: `2px solid ${colors.border}`,
                  borderRadius: borderRadius.lg,
                  fontSize: '15px',
                  color: colors.textPrimary
                }}
              />
              <button
                type="submit"
                disabled={!newItemName.trim()}
                style={{
                  padding: '14px 24px',
                  borderRadius: borderRadius.lg,
                  fontSize: '15px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: newItemName.trim() ? 'pointer' : 'not-allowed',
                  background: newItemName.trim() ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : colors.border,
                  color: 'white',
                  boxShadow: newItemName.trim() ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={18} /> Add
              </button>
            </form>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category} style={{ marginBottom: groupBy === 'category' ? '24px' : '0' }}>
                  {groupBy === 'category' && (
                    <div style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {category}
                      <span style={{ color: colors.textSecondary, fontSize: '14px' }}>({categoryItems.length})</span>
                    </div>
                  )}
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        background: colors.background,
                        borderRadius: borderRadius.lg,
                        marginBottom: '12px',
                        opacity: item.checked ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div
                        onClick={() => toggleChecked(item.id)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: `2px solid ${item.checked ? '#10b981' : colors.border}`,
                          background: item.checked ? '#10b981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {item.checked && <span style={{ color: 'white', fontWeight: '800' }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: colors.textPrimary,
                          textDecoration: item.checked ? 'line-through' : 'none'
                        }}>
                          {item.name}
                          {item.brand && <span style={{ color: colors.textSecondary, fontWeight: '400' }}> • {item.brand}</span>}
                        </div>
                        {item.quantity > 1 && (
                          <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                            Qty: {item.quantity}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: 'white',
                          border: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          opacity: 0.6,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fef2f2';
                          e.currentTarget.style.borderColor = '#fca5a5';
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = colors.border;
                          e.currentTarget.style.opacity = '0.6';
                        }}
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: colors.textSecondary }}>
                  <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <p style={{ fontSize: '16px', fontWeight: '600' }}>No items in your shopping list</p>
                  <p style={{ fontSize: '14px' }}>Add items above or suggest from low stock</p>
                </div>
              )}
            </div>

            {stats.checked > 0 && (
              <div style={{ paddingTop: '24px', borderTop: `1px solid ${colors.border}`, marginTop: '24px' }}>
                <button
                  onClick={handleImportChecked}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: borderRadius.lg,
                    fontSize: '15px',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckSquare size={18} /> Add {stats.checked} Checked Items to Inventory
                </button>
              </div>
            )}
          </div>

          <div>
            <div style={{ background: colors.cardBackground, borderRadius: borderRadius.xl, padding: '24px', border: `1px solid ${colors.border}`, marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '16px' }}>
                Summary
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ textAlign: 'center', padding: '16px', background: colors.background, borderRadius: borderRadius.lg }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary }}>{stats.total}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: colors.background, borderRadius: borderRadius.lg }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary }}>{stats.checked}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>Checked</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: colors.background, borderRadius: borderRadius.lg }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary }}>{stats.remaining}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>Remaining</div>
                </div>
              </div>
            </div>

            <div style={{ background: colors.cardBackground, borderRadius: borderRadius.xl, padding: '24px', border: `1px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '16px' }}>
                Quick Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleSuggestLowStock}
                  style={{
                    padding: '14px',
                    background: colors.background,
                    borderRadius: borderRadius.lg,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.textPrimary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: `1px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fffbeb';
                    e.currentTarget.style.color = '#f59e0b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.background;
                    e.currentTarget.style.color = colors.textPrimary;
                  }}
                >
                  <Package size={18} />
                  Add Low Stock Items
                </button>
                <button
                  onClick={handleClearChecked}
                  disabled={stats.checked === 0}
                  style={{
                    padding: '14px',
                    background: colors.background,
                    borderRadius: borderRadius.lg,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: stats.checked > 0 ? colors.textPrimary : colors.textSecondary,
                    cursor: stats.checked > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: `1px solid ${colors.border}`,
                    opacity: stats.checked > 0 ? 1 : 0.5
                  }}
                  onMouseEnter={(e) => {
                    if (stats.checked > 0) {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.background;
                    e.currentTarget.style.color = stats.checked > 0 ? colors.textPrimary : colors.textSecondary;
                  }}
                >
                  <Trash2 size={18} />
                  Clear Checked Items
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
