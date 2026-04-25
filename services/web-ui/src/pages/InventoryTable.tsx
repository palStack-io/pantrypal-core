import { useState, useCallback } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { Edit2, Trash2, X } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { formatDate, getExpiryBadgeText, getExpiryStatus } from '../utils/dateUtils';
import { getEmojiForCategory, getEmojiForLocation } from '../defaults';
import { useTheme } from '../context/ThemeContext';
import type { Item } from '../types';

interface TableFilters {
  filter?: string;
  location?: string;
  category?: string;
  [key: string]: string | undefined;
}

interface InventoryTableProps {
  filters?: TableFilters;
  searchQuery?: string;
}

const COLS = '3fr 1.5fr 1.5fr 0.5fr 1.5fr 80px';
const ROW_HEIGHT = 65;
const MAX_LIST_HEIGHT = 520;

export function InventoryTable({ filters = {}, searchQuery = '' }: InventoryTableProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const { items, loading, removeItem } = useItems();
  const [sortBy, setSortBy] = useState('expiry');
  const [deleteModal, setDeleteModal] = useState<Item | null>(null);

  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name?.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q);
    }
    if (filters.filter === 'expiring') {
      const s = getExpiryStatus(item.expiry_date);
      return s === 'warning' || s === 'critical';
    }
    if (filters.filter === 'expired') return getExpiryStatus(item.expiry_date) === 'expired';
    if (filters.location) return item.location === filters.location;
    if (filters.category) return item.category === filters.category;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'expiry') {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    }
    return sortBy === 'name-asc' ? a.name.localeCompare(b.name) : sortBy === 'name-desc' ? b.name.localeCompare(a.name) : 0;
  });

  const handleDelete = async () => {
    if (deleteModal) {
      await removeItem(deleteModal.id);
      setDeleteModal(null);
    }
  };

  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const item = sortedItems[index];
    const status = getExpiryStatus(item.expiry_date);
    const rowBg = index % 2 === 0
      ? (isDark ? colors.card : '#ffffff')
      : (isDark ? colors.cardHover : '#fafaf9');

    return (
      <div style={{ ...style, display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', background: rowBg, borderBottom: `1px solid ${colors.border}` }}>
        {/* Item */}
        <div style={{ padding: `0 20px`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
            <div style={{ flexShrink: 0, fontSize: '24px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.accentBg, borderRadius: borderRadius.md }}>
              {getEmojiForCategory(item.category)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: '600', color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              {item.brand && <div style={{ fontSize: '12px', color: colors.textSecondary }}>{item.brand}</div>}
            </div>
          </div>
        </div>
        {/* Category */}
        <div style={{ padding: `0 20px` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: isDark ? colors.cardHover : '#f5f5f4', borderRadius: borderRadius.sm, fontSize: '12px' }}>
            {getEmojiForCategory(item.category)} {item.category || 'Uncategorized'}
          </span>
        </div>
        {/* Location */}
        <div style={{ padding: `0 20px`, color: colors.textSecondary, fontSize: '13px' }}>
          {getEmojiForLocation(item.location)} {item.location || 'No location'}
        </div>
        {/* Qty */}
        <div style={{ padding: `0 20px`, fontWeight: '600', color: colors.textPrimary }}>{item.quantity || 1}</div>
        {/* Expiry */}
        <div style={{ padding: `0 20px` }}>
          <div style={{ fontSize: '13px', color: colors.textPrimary }}>{item.expiry_date ? formatDate(item.expiry_date) : 'No expiry'}</div>
          {item.expiry_date && (
            <div style={{ fontSize: '11px', fontWeight: '600', color: status === 'expired' ? colors.expiredText : (status === 'warning' || status === 'critical') ? colors.warningText : colors.goodText }}>
              {(status === 'expired' || status === 'warning' || status === 'critical') ? '⚠️ ' : '✓ '}{getExpiryBadgeText(item.expiry_date)}
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ padding: `0 12px`, display: 'flex', gap: spacing.sm }}>
          <button
            onClick={() => { window.location.href = `/add?id=${item.id}`; }}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: borderRadius.sm, color: colors.textSecondary }}
            onMouseOver={(e) => { e.currentTarget.style.color = colors.info; }}
            onMouseOut={(e) => { e.currentTarget.style.color = colors.textSecondary; }}
            aria-label={`Edit ${item.name}`}
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => setDeleteModal(item)}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: borderRadius.sm, color: colors.textSecondary }}
            onMouseOver={(e) => { e.currentTarget.style.color = colors.danger; }}
            onMouseOut={(e) => { e.currentTarget.style.color = colors.textSecondary; }}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedItems, isDark, colors]);

  if (loading) return <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>;

  const title = searchQuery ? `Search: "${searchQuery}"` : filters.filter === 'expiring' ? 'Expiring Soon' : filters.filter === 'expired' ? 'Expired Items' : filters.location || filters.category || 'All Items';
  const listHeight = Math.min(sortedItems.length * ROW_HEIGHT, MAX_LIST_HEIGHT);

  return (
    <div style={{ padding: `${spacing.xl} ${spacing.xxl}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.textPrimary }}>{title}</h1>
        <div style={{ display: 'flex', gap: spacing.sm, color: colors.textSecondary, fontSize: '14px', alignItems: 'center' }}>
          <span>Sort by:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px 12px', border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '14px', background: colors.card, color: colors.textPrimary, cursor: 'pointer' }}>
            <option value="expiry">Expiry (Soonest)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      <div style={{ background: colors.card, borderRadius: borderRadius.xl, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: COLS, background: isDark ? colors.cardHover : '#fafaf9', borderBottom: `2px solid ${colors.border}` }}>
          {['Item', 'Category', 'Location', 'Qty', 'Expiry Date', 'Actions'].map((h, i) => (
            <div key={h} style={{ padding: `${spacing.lg} 20px`, ...(i === 5 && { paddingLeft: '12px' }), fontSize: '13px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {sortedItems.length > 0 ? (
          <FixedSizeList
            height={listHeight}
            itemCount={sortedItems.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            style={{ overflowX: 'hidden' }}
          >
            {Row}
          </FixedSizeList>
        ) : (
          <div style={{ padding: spacing.xxxl, textAlign: 'center', color: colors.textSecondary }}>
            {searchQuery || filters.filter || filters.location || filters.category ? 'No items found.' : 'No items. Click "Add New Item"!'}
          </div>
        )}
      </div>

      {deleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteModal(null)}>
          <div style={{ background: colors.card, borderRadius: borderRadius.xl, padding: spacing.xxl, maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.textPrimary }}>Delete Item?</h2>
              <button onClick={() => setDeleteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><X size={24} /></button>
            </div>
            <p style={{ marginBottom: spacing.xl, color: colors.textSecondary }}>
              Are you sure you want to delete <strong style={{ color: colors.textPrimary }}>"{deleteModal.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: spacing.md }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: spacing.md, border: `2px solid ${colors.border}`, background: colors.card, borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: '600', color: colors.textPrimary }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: spacing.md, border: 'none', background: colors.danger, color: 'white', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: '600' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryTable;
