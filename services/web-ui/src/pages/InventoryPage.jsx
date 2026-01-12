// Inventory page - full item list with filtering and bulk actions
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Grid, List, Plus, Minus } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import FilterPanel from '../components/FilterPanel';
import BulkActions from '../components/BulkActions';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import EditItemModal from '../components/EditItemModal';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { useLocations } from '../hooks/useLocations';
import { exportToCSV, downloadCSVTemplate, readCSVFile, validateImportedItems } from '../utils/exportUtils';
import { filterByExpiryStatus, sortByExpiry, getExpiryStatus, formatDate } from '../utils/dateUtils';
import { exportItemsCSV } from '../api';

export function InventoryPage({ isDark, sidebarFilters = {} }) {
  const colors = getColors(isDark);
  const { items, loading, error, removeItems, editItem } = useItems();
  const { locations, categories } = useLocations();
  const [filters, setFilters] = useState({ expiryStatus: 'all' });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [groupBy, setGroupBy] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [editingItem, setEditingItem] = useState(null);

  // Merge sidebar filters with local filters
  const mergedFilters = { ...filters, ...sidebarFilters };

  // Apply filters
  const filteredItems = items.filter(item => {
    if (mergedFilters.search && !item.name.toLowerCase().includes(mergedFilters.search.toLowerCase())) return false;
    if (mergedFilters.location && item.location !== mergedFilters.location) return false;
    if (mergedFilters.category && item.category !== mergedFilters.category) return false;

    // Handle expiry filter from sidebar
    if (mergedFilters.filter === 'expiring') {
      const status = getExpiryStatus(item.expiry_date);
      return status === 'warning' || status === 'critical';
    }
    if (mergedFilters.filter === 'expired') {
      const status = getExpiryStatus(item.expiry_date);
      return status === 'expired';
    }

    // Handle expiry status from filter panel
    if (mergedFilters.expiryStatus && mergedFilters.expiryStatus !== 'all') {
      return filterByExpiryStatus([item], mergedFilters.expiryStatus).length > 0;
    }
    return true;
  });

  const sortedItems = sortByExpiry(filteredItems);

  // Grouping logic
  const groupedItems = groupBy === 'none' ? { 'All Items': sortedItems } :
    sortedItems.reduce((groups, item) => {
      const key = groupBy === 'location' ? (item.location || 'No Location') :
                  groupBy === 'category' ? (item.category || 'No Category') : 'All Items';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Collapse all groups by default when grouping changes
  useEffect(() => {
    if (groupBy !== 'none') {
      const allGroupKeys = Object.keys(groupedItems);
      setCollapsedGroups(new Set(allGroupKeys));
    } else {
      setCollapsedGroups(new Set());
    }
  }, [groupBy]);

  // Auto-expand groups when search is active and has matches
  useEffect(() => {
    if (filters.search && groupBy !== 'none') {
      const groupsWithMatches = Object.entries(groupedItems)
        .filter(([_, items]) => items.length > 0)
        .map(([key, _]) => key);

      setCollapsedGroups(prev => {
        const next = new Set(prev);
        groupsWithMatches.forEach(key => next.delete(key));
        return next;
      });
    }
  }, [filters.search, groupedItems, groupBy]);

  const handleSelect = (item) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedItems.size} items?`)) {
      try {
        await removeItems(Array.from(selectedItems));
        setSelectedItems(new Set());
      } catch (err) {
        alert('Failed to delete items');
      }
    }
  };

  const handleExport = async () => {
    try {
      await exportItemsCSV();
    } catch (err) {
      alert('Failed to export items');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: spacing.xl }}>
      <div style={{ marginBottom: spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Inventory</h1>
      </div>

      {error && <Alert type="error" message={error} />}

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        locations={locations}
        categories={categories}
        isDark={isDark}
      />

      <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={{
              padding: spacing.sm,
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.card,
              color: colors.textPrimary,
            }}
          >
            <option value="none">None</option>
            <option value="location">Location</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: spacing.xs }}>
          <button
            onClick={() => setViewMode('card')}
            style={{
              padding: spacing.sm,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.sm,
              backgroundColor: viewMode === 'card' ? colors.primary : colors.card,
              color: viewMode === 'card' ? colors.textPrimary : colors.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
            title="Card view"
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: spacing.sm,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.sm,
              backgroundColor: viewMode === 'list' ? colors.primary : colors.card,
              color: viewMode === 'list' ? colors.textPrimary : colors.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {Object.entries(groupedItems)
        .filter(([_, groupItems]) => groupItems.length > 0)
        .map(([group, groupItems]) => {
          const isCollapsed = collapsedGroups.has(group);
          const Icon = isCollapsed ? ChevronRight : ChevronDown;

          return (
            <div key={group} style={{ marginBottom: spacing.xxl }}>
              {groupBy !== 'none' && (
                <div
                  onClick={() => toggleGroup(group)}
                  style={{
                    marginBottom: spacing.lg,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    transition: 'background-color 0.2s',
                    backgroundColor: isCollapsed ? colors.background : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.background}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isCollapsed ? colors.background : 'transparent'}
                >
                  <Icon size={20} color={colors.textSecondary} />
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: colors.textSecondary }}>
                    {group} ({groupItems.length})
                  </h2>
                </div>
              )}
              {!isCollapsed && (
                viewMode === 'card' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
                    {groupItems.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        onSelect={handleSelect}
                        onEdit={() => setEditingItem(item)}
                        onDelete={() => removeItems([item.id])}
                        onQuantityChange={(id, qty) => editItem(id, { quantity: qty })}
                        isDark={isDark}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.lg,
                    overflow: 'hidden',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: colors.background }}>
                          <th style={{ padding: spacing.md, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Name</th>
                          <th style={{ padding: spacing.md, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Location</th>
                          <th style={{ padding: spacing.md, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Category</th>
                          <th style={{ padding: spacing.md, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Expiry</th>
                          <th style={{ padding: spacing.md, textAlign: 'center', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Quantity</th>
                          <th style={{ padding: spacing.md, textAlign: 'center', fontSize: '14px', fontWeight: '600', color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupItems.map(item => {
                          const expiryColor = getExpiryStatus(item.expiry_date) === 'expired' ? colors.danger :
                                             getExpiryStatus(item.expiry_date) === 'critical' ? colors.warning : colors.info;
                          const expiryBadge = item.expiry_date ? formatDate(item.expiry_date) : 'N/A';

                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              style={{
                                backgroundColor: selectedItems.has(item.id) ? colors.primary + '10' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = selectedItems.has(item.id) ? colors.primary + '20' : colors.background}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedItems.has(item.id) ? colors.primary + '10' : 'transparent'}
                            >
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textPrimary, fontWeight: '500' }}>
                                {item.name}
                              </td>
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                                {item.location || 'N/A'}
                              </td>
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                                {item.category || 'N/A'}
                              </td>
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>
                                <span style={{
                                  padding: `${spacing.xs} ${spacing.sm}`,
                                  backgroundColor: expiryColor + '20',
                                  color: expiryColor,
                                  borderRadius: borderRadius.sm,
                                  fontSize: '12px',
                                  fontWeight: '600',
                                }}>
                                  {expiryBadge}
                                </span>
                              </td>
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editItem(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) });
                                    }}
                                    style={{
                                      background: colors.background,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: borderRadius.sm,
                                      padding: '4px',
                                      cursor: 'pointer',
                                      color: colors.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    title="Decrease quantity"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span style={{ color: colors.textPrimary, fontWeight: '600', minWidth: '30px', textAlign: 'center' }}>
                                    {item.quantity || 1}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editItem(item.id, { quantity: (item.quantity || 1) + 1 });
                                    }}
                                    style={{
                                      background: colors.background,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: borderRadius.sm,
                                      padding: '4px',
                                      cursor: 'pointer',
                                      color: colors.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    title="Increase quantity"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingItem(item);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: colors.textSecondary,
                                      padding: spacing.xs,
                                    }}
                                    title="Edit item"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeItems([item.id]);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: colors.danger,
                                      padding: spacing.xs,
                                    }}
                                    title="Delete item"
                                  >
                                    Delete
                                  </button>
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
        })
      }

      {sortedItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: spacing.xxxl, color: colors.textSecondary }}>
          No items found. Try adjusting your filters or add new items.
        </div>
      )}

      <BulkActions
        selectedCount={selectedItems.size}
        onDelete={handleBulkDelete}
        onExport={handleExport}
        onClear={() => setSelectedItems(new Set())}
      />

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={editItem}
          locations={locations}
          categories={categories}
          isDark={isDark}
        />
      )}
    </div>
  );
}

export default InventoryPage;
