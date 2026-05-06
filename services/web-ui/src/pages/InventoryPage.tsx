import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Grid, List, Plus, Minus } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import FilterPanel from '../components/FilterPanel';
import BulkActions from '../components/BulkActions';
import { InventorySkeleton } from '../components/SkeletonLoader';
import Alert from '../components/Alert';
import EditItemModal from '../components/EditItemModal';
import QRLabelModal from '../components/QRLabelModal';
import { useToast } from '../components/Toast';
import { useDialog } from '../components/DialogProvider';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { useTheme } from '../context/ThemeContext';
import { useLocations } from '../hooks/useLocations';
import { exportItemsCSV } from '../api';
import { filterByExpiryStatus, sortByExpiry, getExpiryStatus, formatDate } from '../utils/dateUtils';
import type { Item } from '../types';

interface SidebarFilters {
  filter?: string | null;
  location?: string | null;
  category?: string | null;
  search?: string;
  expiryStatus?: string;
  [key: string]: string | null | undefined;
}

interface InventoryPageProps {
  sidebarFilters?: SidebarFilters;
}

export function InventoryPage({ sidebarFilters = {} }: InventoryPageProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const toast = useToast();
  const dialog = useDialog();
  const { items, loading, error, removeItems, editItem, page, totalPages, total, goToPage } = useItems();
  const { locations, categories, categoryObjects } = useLocations();
  const [filters, setFilters] = useState<SidebarFilters>({ expiryStatus: 'all' });
  const [selectedItems, setSelectedItems] = useState<Set<number | string>>(new Set());
  const [groupBy, setGroupBy] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [qrLabelItem, setQrLabelItem] = useState<Item | null>(null);

  const handleDeleteItem = (ids: (number | string)[]) => {
    const undo = removeItems(ids);
    const count = ids.length;
    toast.show({ message: count === 1 ? 'Item deleted.' : `${count} items deleted.`, type: 'info', duration: 5500, action: { label: 'Undo', onClick: undo } });
  };

  const mergedFilters = { ...filters, ...sidebarFilters };

  const filteredItems = items.filter(item => {
    if (mergedFilters.search && !item.name.toLowerCase().includes(mergedFilters.search.toLowerCase())) return false;
    if (mergedFilters.location && item.location !== mergedFilters.location) return false;
    if (mergedFilters.category && item.category !== mergedFilters.category) return false;
    if (mergedFilters.filter === 'expiring') {
      const status = getExpiryStatus(item.expiry_date);
      return status === 'warning' || status === 'critical';
    }
    if (mergedFilters.filter === 'expired') {
      const status = getExpiryStatus(item.expiry_date);
      return status === 'expired';
    }
    if (mergedFilters.expiryStatus && mergedFilters.expiryStatus !== 'all') {
      return filterByExpiryStatus([item], mergedFilters.expiryStatus).length > 0;
    }
    return true;
  });

  const sortedItems = sortByExpiry(filteredItems);

  const groupedItems: Record<string, Item[]> = groupBy === 'none' ? { 'All Items': sortedItems } :
    sortedItems.reduce<Record<string, Item[]>>((groups, item) => {
      const key = groupBy === 'location' ? (item.location || 'No Location') :
                  groupBy === 'category' ? (item.category || 'No Category') : 'All Items';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});

  const handleFilterChange = (newFilters: Partial<SidebarFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  useEffect(() => {
    if (groupBy !== 'none') {
      setCollapsedGroups(new Set(Object.keys(groupedItems)));
    } else {
      setCollapsedGroups(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  useEffect(() => {
    if (filters.search && groupBy !== 'none') {
      const groupsWithMatches = Object.entries(groupedItems)
        .filter(([, grpItems]) => grpItems.length > 0)
        .map(([key]) => key);
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        groupsWithMatches.forEach(key => next.delete(key));
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, groupedItems, groupBy]);

  const handleSelect = (item: Item) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (await dialog.confirm(`${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} will be permanently removed.`, { title: `Delete ${selectedItems.size} Item${selectedItems.size !== 1 ? 's' : ''}`, confirmLabel: 'Delete', icon: '🗑️' })) {
      handleDeleteItem(Array.from(selectedItems));
      setSelectedItems(new Set());
    }
  };

  const handleExport = async () => {
    try { await exportItemsCSV(); }
    catch { toast.error('Failed to export items'); }
  };

  const handleAddToShoppingList = async () => {
    const selectedItemObjects = items.filter(item => selectedItems.has(item.id));
    try {
      await Promise.all(selectedItemObjects.map(item =>
        fetch('/api/shopping-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: item.name, quantity: 1, category: item.category || '' }) }).then(r => { if (!r.ok) throw new Error(); })
      ));
      toast.success(`${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} added to shopping list`);
      setSelectedItems(new Set());
    } catch {
      toast.error('Failed to add items to shopping list');
    }
  };

  if (loading) return (
    <div style={{ padding: spacing.xl }}>
      <div style={{ marginBottom: spacing.xl }}><h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Inventory</h1></div>
      <InventorySkeleton count={6} />
    </div>
  );

  return (
    <div style={{ padding: spacing.xl }}>
      <div style={{ marginBottom: spacing.xl }}><h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Inventory</h1></div>

      {error && <Alert type="error" message={error} />}

      <FilterPanel filters={filters} onFilterChange={handleFilterChange} locations={locations} categories={categories} />

      <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>Group by:</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ padding: spacing.sm, borderRadius: borderRadius.sm, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.textPrimary }}>
            <option value="none">None</option>
            <option value="location">Location</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <button onClick={() => setViewMode('card')} style={{ padding: spacing.sm, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, backgroundColor: viewMode === 'card' ? colors.primary : colors.card, color: viewMode === 'card' ? colors.textPrimary : colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing.xs }} title="Card view"><Grid size={18} /></button>
          <button onClick={() => setViewMode('list')} style={{ padding: spacing.sm, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, backgroundColor: viewMode === 'list' ? colors.primary : colors.card, color: viewMode === 'list' ? colors.textPrimary : colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing.xs }} title="List view"><List size={18} /></button>
        </div>
      </div>

      {Object.entries(groupedItems).filter(([, groupItems]) => groupItems.length > 0).map(([group, groupItems]) => {
        const isCollapsed = collapsedGroups.has(group);
        const Icon = isCollapsed ? ChevronRight : ChevronDown;
        return (
          <div key={group} style={{ marginBottom: spacing.xxl }}>
            {groupBy !== 'none' && (
              <div onClick={() => toggleGroup(group)} style={{ marginBottom: spacing.lg, display: 'flex', alignItems: 'center', gap: spacing.sm, cursor: 'pointer', userSelect: 'none', padding: spacing.md, borderRadius: borderRadius.md, transition: 'background-color 0.2s', backgroundColor: isCollapsed ? colors.background : 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.background}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isCollapsed ? colors.background : 'transparent'; }}>
                <Icon size={20} color={colors.textSecondary} />
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: colors.textSecondary }}>{group} ({groupItems.length})</h2>
              </div>
            )}
            {!isCollapsed && (
              viewMode === 'card' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
                  {groupItems.map(item => (
                    <ItemCard key={item.id} item={item} isSelected={selectedItems.has(item.id)} onSelect={handleSelect} onEdit={() => setEditingItem(item)} onDelete={() => handleDeleteItem([item.id])} onQRLabel={(item) => setQrLabelItem(item)} onQuantityChange={(id, qty) => editItem(id, { quantity: qty })} />
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, overflowX: 'auto', border: `1px solid ${colors.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.background }}>
                        {['Name', 'Location', 'Category', 'Expiry', 'Quantity', 'Actions'].map(h => (
                          <th key={h} style={{ padding: spacing.md, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map(item => {
                        const expiryColor = getExpiryStatus(item.expiry_date) === 'expired' ? colors.danger : getExpiryStatus(item.expiry_date) === 'critical' ? colors.warning : colors.info;
                        const expiryBadge = item.expiry_date ? formatDate(item.expiry_date) : 'N/A';
                        return (
                          <tr key={item.id} onClick={() => handleSelect(item)} style={{ backgroundColor: selectedItems.has(item.id) ? colors.primary + '10' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = selectedItems.has(item.id) ? colors.primary + '20' : colors.background; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedItems.has(item.id) ? colors.primary + '10' : 'transparent'; }}>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textPrimary, fontWeight: '500' }}>{item.name}</td>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{item.location || 'N/A'}</td>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{item.category || 'N/A'}</td>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>
                              <span style={{ padding: `${spacing.xs} ${spacing.sm}`, backgroundColor: expiryColor + '20', color: expiryColor, borderRadius: borderRadius.sm, fontSize: '12px', fontWeight: '600' }}>{expiryBadge}</span>
                            </td>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                                <button onClick={(e) => { e.stopPropagation(); editItem(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) }); }} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, padding: '4px', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Decrease quantity"><Minus size={14} /></button>
                                <span style={{ color: colors.textPrimary, fontWeight: '600', minWidth: '30px', textAlign: 'center' }}>{item.quantity || 1}</span>
                                <button onClick={(e) => { e.stopPropagation(); editItem(item.id, { quantity: (item.quantity || 1) + 1 }); }} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: borderRadius.sm, padding: '4px', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Increase quantity"><Plus size={14} /></button>
                              </div>
                            </td>
                            <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'center' }}>
                                {item.manually_added && <button onClick={(e) => { e.stopPropagation(); setQrLabelItem(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.qr_label_generated ? colors.primary : colors.textSecondary, padding: spacing.xs }} title={item.qr_label_generated ? 'View QR Label' : 'Get QR Label'}>QR</button>}
                                <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: spacing.xs }} title="Edit item">Edit</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteItem([item.id]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, padding: spacing.xs }} title="Delete item">Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        );
      })}

      {sortedItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: spacing.xxxl, color: colors.textSecondary }}>No items found. Try adjusting your filters or add new items.</div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl }}>
          <button onClick={() => goToPage(page - 1)} disabled={page === 0} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: `1px solid ${colors.border}`, backgroundColor: page === 0 ? colors.border : colors.card, color: page === 0 ? colors.textTertiary : colors.textPrimary, cursor: page === 0 ? 'not-allowed' : 'pointer', fontWeight: '600' }}>← Previous</button>
          <span style={{ fontSize: '14px', color: colors.textSecondary, minWidth: '120px', textAlign: 'center' }}>Page {page + 1} of {totalPages} ({total} items)</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: `1px solid ${colors.border}`, backgroundColor: page >= totalPages - 1 ? colors.border : colors.card, color: page >= totalPages - 1 ? colors.textTertiary : colors.textPrimary, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}>Next →</button>
        </div>
      )}

      <BulkActions selectedCount={selectedItems.size} onDelete={handleBulkDelete} onExport={handleExport} onClear={() => setSelectedItems(new Set())} onAddToShoppingList={handleAddToShoppingList} />

      {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} onSave={editItem} locations={locations} categories={categories} categoryObjects={categoryObjects} />}
      {qrLabelItem && <QRLabelModal item={qrLabelItem} onClose={() => setQrLabelItem(null)} />}
    </div>
  );
}

export default InventoryPage;
