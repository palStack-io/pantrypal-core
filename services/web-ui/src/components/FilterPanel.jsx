// Filter panel for inventory
import { Search, MapPin, Tag, Calendar, X } from 'lucide-react';
import { getColors, borderRadius, spacing, getShadows } from '../colors';

export function FilterPanel({ filters, onFilterChange, locations, categories, isDark }) {
  const colors = getColors(isDark);
  const shadows = getShadows(isDark);
  const expiryOptions = [
    { value: 'all', label: 'All Items' },
    { value: 'good', label: 'Good (7+ days)' },
    { value: 'warning', label: 'Warning (3-7 days)' },
    { value: 'critical', label: 'Critical (0-3 days)' },
    { value: 'expired', label: 'Expired' },
  ];

  const hasActiveFilters = filters.search || filters.location || filters.category || filters.expiryStatus !== 'all';

  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.medium,
        padding: spacing.xl,
        marginBottom: spacing.xl,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: spacing.lg }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={() => onFilterChange({})}
            style={{
              background: 'none',
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: borderRadius.sm,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: '14px',
              color: colors.textSecondary,
            }}
          >
            <X size={16} />
            Clear All
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
        {/* Search */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: spacing.sm, color: colors.textPrimary }}>
            <Search size={16} style={{ verticalAlign: 'middle', marginRight: spacing.xs }} />
            Search
          </label>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search items..."
            style={{
              width: '100%',
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              backgroundColor: colors.background,
              color: colors.textPrimary,
            }}
          />
        </div>

        {/* Location */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: spacing.sm, color: colors.textPrimary }}>
            <MapPin size={16} style={{ verticalAlign: 'middle', marginRight: spacing.xs }} />
            Location
          </label>
          <select
            value={filters.location || ''}
            onChange={(e) => onFilterChange({ location: e.target.value })}
            style={{
              width: '100%',
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              backgroundColor: colors.background,
              color: colors.textPrimary,
            }}
          >
            <option value="">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: spacing.sm, color: colors.textPrimary }}>
            <Tag size={16} style={{ verticalAlign: 'middle', marginRight: spacing.xs }} />
            Category
          </label>
          <select
            value={filters.category || ''}
            onChange={(e) => onFilterChange({ category: e.target.value })}
            style={{
              width: '100%',
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              backgroundColor: colors.background,
              color: colors.textPrimary,
            }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Expiry Status */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: spacing.sm, color: colors.textPrimary }}>
            <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: spacing.xs }} />
            Expiry Status
          </label>
          <select
            value={filters.expiryStatus || 'all'}
            onChange={(e) => onFilterChange({ expiryStatus: e.target.value })}
            style={{
              width: '100%',
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              backgroundColor: colors.background,
              color: colors.textPrimary,
            }}
          >
            {expiryOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
