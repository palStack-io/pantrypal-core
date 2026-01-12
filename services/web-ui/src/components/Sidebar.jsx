// Sidebar - Minimal Design with Working Navigation
import { useState, useEffect } from 'react';
import { Package, AlertTriangle, XCircle, Plus, ShoppingCart } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows, getGradient } from '../colors';
import { useItems } from '../hooks/useItems';
import { getExpiryStatus } from '../utils/dateUtils';

export function Sidebar({ isOpen, currentPath, onNavigate, isDark, onFilterChange, currentFilters = {} }) {
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);
  const shadows = getShadows(isDark);
  const { items } = useItems();
  const [stats, setStats] = useState({ total: 0, expiring: 0, expired: 0 });
  const [locationCounts, setLocationCounts] = useState({});
  const [categoryCounts, setCategoryCounts] = useState({});

  useEffect(() => {
    if (items.length > 0) {
      let expiring = 0, expired = 0;
      const locs = {}, cats = {};
      items.forEach(item => {
        const status = getExpiryStatus(item.expiry_date);
        if (status === 'expired') expired++;
        else if (status === 'critical' || status === 'warning') expiring++;
        if (item.location) locs[item.location] = (locs[item.location] || 0) + 1;
        if (item.category) cats[item.category] = (cats[item.category] || 0) + 1;
      });
      setStats({ total: items.length, expiring, expired });
      setLocationCounts(locs);
      setCategoryCounts(cats);
    }
  }, [items]);

  const locationIcons = {
    'Basement Pantry': '🏠', 'Kitchen Pantry': '🍴', 'Kitchen Fridge': '❄️',
    'Fridge': '❄️', 'Pantry': '🏠', 'Freezer': '🧊',
  };

  const categoryIcons = {
    'Canned Goods': '🥫', 'Dry Goods': '🌾', 'Dairy': '🧊',
    'Beverages': '🥤', 'Snacks': '🍿', 'Condiments': '🍯',
  };

  if (!isOpen) return null;

  return (
    <div className="sidebar" style={{ background: colors.card }}>
      <div style={{ padding: spacing.xl, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: '24px', fontWeight: '700', color: colors.primary, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: spacing.lg }}>
          🥫 PantryPal
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: colors.accentBg, borderRadius: borderRadius.md, fontSize: '14px' }}>
            <span style={{ color: colors.textSecondary, fontWeight: '500' }}>Total Items</span>
            <span style={{ fontWeight: '700', color: colors.primary }}>{stats.total}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: colors.accentBg, borderRadius: borderRadius.md, fontSize: '14px' }}>
            <span style={{ color: colors.textSecondary, fontWeight: '500' }}>Expiring Soon</span>
            <span style={{ fontWeight: '700', color: colors.primary }}>{stats.expiring}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: spacing.lg, overflowY: 'auto' }}>
        <NavSection title="Views" colors={colors}>
          <NavItem
            icon={<Package size={18} />}
            label="All Items"
            count={stats.total}
            active={currentPath === '/inventory' && !currentFilters.filter}
            onClick={() => { onNavigate('/inventory'); onFilterChange({ filter: null, location: null, category: null }); }}
            colors={colors}
            gradient={gradient}
          />
          <NavItem
            icon={<ShoppingCart size={18} />}
            label="Shopping List"
            active={currentPath === '/shopping'}
            onClick={() => { onNavigate('/shopping'); }}
            colors={colors}
            gradient={gradient}
          />
          <NavItem
            icon={<AlertTriangle size={18} />}
            label="Expiring Soon"
            count={stats.expiring}
            active={currentFilters.filter === 'expiring'}
            onClick={() => { onNavigate('/inventory'); onFilterChange({ filter: 'expiring', location: null, category: null }); }}
            colors={colors}
            gradient={gradient}
          />
          <NavItem
            icon={<XCircle size={18} />}
            label="Expired"
            count={stats.expired}
            active={currentFilters.filter === 'expired'}
            onClick={() => { onNavigate('/inventory'); onFilterChange({ filter: 'expired', location: null, category: null }); }}
            colors={colors}
            gradient={gradient}
          />
        </NavSection>

        {Object.keys(locationCounts).length > 0 && (
          <NavSection title="Locations" colors={colors}>
            {Object.entries(locationCounts).map(([location, count]) => (
              <NavItem
                key={location}
                icon={locationIcons[location] || '📍'}
                label={location}
                count={count}
                active={currentFilters.location === location}
                onClick={() => { onNavigate('/inventory'); onFilterChange({ filter: null, location: location, category: null }); }}
                colors={colors}
                gradient={gradient}
              />
            ))}
          </NavSection>
        )}

        {Object.keys(categoryCounts).length > 0 && (
          <NavSection title="Categories" colors={colors}>
            {Object.entries(categoryCounts).slice(0, 5).map(([category, count]) => (
              <NavItem
                key={category}
                icon={categoryIcons[category] || '🏷️'}
                label={category}
                count={count}
                active={currentFilters.category === category}
                onClick={() => { onNavigate('/inventory'); onFilterChange({ filter: null, location: null, category: category }); }}
                colors={colors}
                gradient={gradient}
              />
            ))}
          </NavSection>
        )}
      </div>

      <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
        <button
          onClick={() => onNavigate('/add')}
          style={{
            width: '100%',
            background: gradient.primary,
            color: 'white',
            border: 'none',
            padding: '14px',
            borderRadius: borderRadius.lg,
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            boxShadow: shadows.large,
          }}
        >
          <Plus size={20} />
          <span>Add New Item</span>
        </button>
      </div>
    </div>
  );
}

function NavSection({ title, children, colors }) {
  return (
    <div style={{ marginBottom: spacing.xl }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, padding: `0 ${spacing.sm}` }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function NavItem({ icon, label, count, active, onClick, colors, gradient }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        fontSize: '14px',
        marginBottom: '4px',
        background: active ? gradient.primary : (hover ? colors.accentBg : 'transparent'),
        color: active ? 'white' : colors.textPrimary,
        fontWeight: active ? '600' : '500',
        transition: 'all 0.2s',
      }}
    >
      {typeof icon === 'string' ? <span>{icon}</span> : icon}
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && (
        <span style={{
          background: active ? 'rgba(255, 255, 255, 0.3)' : colors.accentBg,
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

export default Sidebar;