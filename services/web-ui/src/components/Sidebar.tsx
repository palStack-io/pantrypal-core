import { useState, ReactNode, MouseEvent } from 'react';
import { Package, AlertTriangle, XCircle, Plus, ShoppingCart, TrendingUp, ChefHat, ChevronDown } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows, getGradient } from '../colors';
import { useInventoryStats } from '../hooks/useInventoryStats';
import { getEmojiForLocation, getEmojiForCategory } from '../defaults';
import { useTheme } from '../context/ThemeContext';

/**
 * *** THE ROWS IN HERE WERE `<div onClick>`. ***
 *
 * All of them -- six views, every location, every category, and the two
 * collapsible section headers. That is one defect with three consequences:
 * none of them were reachable by keyboard, none were announced as controls,
 * and the four that navigate could not be middle-clicked or opened in a new
 * tab. On a pantry with a handful of locations that is ~20 unreachable
 * controls, in the primary navigation.
 *
 * So the element now follows the job:
 *   - a row that NAVIGATES is an `<a href>`, with the modified-click
 *     passthrough that makes cmd/ctrl/middle-click behave normally;
 *   - a row that TOGGLES A FILTER is a `<button aria-pressed>`, because it
 *     changes state on the current page rather than going anywhere;
 *   - a collapsible heading is a `<button aria-expanded>`.
 *
 * Counts come from `useInventoryStats` (GET /api/stats), not `useItems()`.
 * See that hook for why -- briefly: useItems paginates at 50, so this panel
 * confidently reported "50" for a 96-item pantry.
 */

const ROW_MIN_HEIGHT = 44;   // WCAG 2.5.5 / the iOS HIG figure, not the 24px AA floor

interface SidebarProps {
  isOpen: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  onFilterChange: (filters: Record<string, string | null>) => void;
  currentFilters?: Record<string, string | null>;
}

interface NavSectionProps {
  title: string;
  children: ReactNode;
  colors: ReturnType<typeof getColors>;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

interface RowVisualProps {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  colors: ReturnType<typeof getColors>;
  gradient: ReturnType<typeof getGradient>;
}

function rowStyle(active: boolean, hover: boolean, colors: ReturnType<typeof getColors>, gradient: ReturnType<typeof getGradient>) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: ROW_MIN_HEIGHT,
    padding: '0 12px',
    border: 'none',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '4px',
    textDecoration: 'none',
    background: active ? gradient.primary : (hover ? colors.accentBg : 'transparent'),
    color: active ? colors.onPrimary : colors.textPrimary,
    fontWeight: active ? 600 : 500,
    transition: 'all 0.2s',
  };
}

function RowContent({ icon, label, count, active, colors }: RowVisualProps) {
  return (
    <>
      {typeof icon === 'string' ? <span aria-hidden="true">{icon}</span> : icon}
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{
          background: active ? 'rgba(255, 255, 255, 0.3)' : colors.accentBg,
          padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </>
  );
}

/** A row that goes somewhere. A real link, so the browser's own affordances work. */
function NavLinkRow({ id, href, onNavigate, ...visual }: RowVisualProps & { id?: string; href: string; onNavigate: (path: string) => void }) {
  const [hover, setHover] = useState(false);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle cmd/ctrl/shift-click and middle-click -- the
    // whole reason this is an <a> and not a <button>.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(href);
  };
  return (
    <a
      id={id}
      href={href}
      onClick={handle}
      aria-current={visual.active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={rowStyle(visual.active, hover, visual.colors, visual.gradient)}
    >
      <RowContent {...visual} />
    </a>
  );
}

/** A row that filters the current view. Stateful, so a button with aria-pressed. */
function NavFilterRow({ id, onClick, ...visual }: RowVisualProps & { id?: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-pressed={visual.active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={rowStyle(visual.active, hover, visual.colors, visual.gradient)}
    >
      <RowContent {...visual} />
    </button>
  );
}

export function Sidebar({ isOpen, currentPath, onNavigate, onFilterChange, currentFilters = {} }: SidebarProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);
  const shadows = getShadows(isDark);
  const { stats } = useInventoryStats();

  if (!isOpen) return null;

  const clearFilters = { filter: null, location: null, category: null };
  const shared = { colors, gradient };

  return (
    <nav id="app-sidebar" className="sidebar open" aria-label="Main" style={{ background: colors.card }}>
      <div style={{ padding: spacing.xl, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: '24px', fontWeight: '700', color: colors.primary, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: spacing.lg }}>
          <img src="/pantryPal.png" alt="" aria-hidden="true" style={{ width: '28px', height: '28px' }} /> pantryPal
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: colors.accentBg, borderRadius: borderRadius.md, fontSize: '14px' }}>
            <span style={{ color: colors.textSecondary, fontWeight: '500' }}>Total Items</span>
            <span style={{ fontWeight: '700', color: colors.primary }}>{stats.total_items}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: colors.accentBg, borderRadius: borderRadius.md, fontSize: '14px' }}>
            <span style={{ color: colors.textSecondary, fontWeight: '500' }}>Expiring Soon</span>
            <span style={{ fontWeight: '700', color: colors.primary }}>{stats.expiring_soon}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: spacing.lg, overflowY: 'auto' }}>
        <NavSection title="Views" colors={colors}>
          <NavLinkRow
            id="tour-nav-inventory" href="/inventory" onNavigate={p => { onNavigate(p); onFilterChange(clearFilters); }}
            icon={<Package size={18} />} label="All Items" count={stats.total_items}
            active={currentPath === '/inventory' && !currentFilters.filter} {...shared}
          />
          <NavLinkRow
            id="tour-nav-shopping" href="/shopping" onNavigate={p => { onNavigate(p); onFilterChange(clearFilters); }}
            icon={<ShoppingCart size={18} />} label="Shopping List"
            active={currentPath === '/shopping'} {...shared}
          />
          <NavLinkRow
            id="tour-nav-insights" href="/insights" onNavigate={p => { onNavigate(p); onFilterChange(clearFilters); }}
            icon={<TrendingUp size={18} />} label="Insights"
            active={currentPath === '/insights'} {...shared}
          />
          <NavLinkRow
            id="tour-nav-recipes" href="/recipes" onNavigate={p => { onNavigate(p); onFilterChange(clearFilters); }}
            icon={<ChefHat size={18} />} label="Recipes"
            active={currentPath === '/recipes'} {...shared}
          />
          <NavFilterRow
            onClick={() => { onNavigate('/inventory'); onFilterChange({ ...clearFilters, filter: 'expiring' }); }}
            icon={<AlertTriangle size={18} />} label="Expiring Soon" count={stats.expiring_soon}
            active={currentFilters.filter === 'expiring'} {...shared}
          />
          <NavFilterRow
            onClick={() => { onNavigate('/inventory'); onFilterChange({ ...clearFilters, filter: 'expired' }); }}
            icon={<XCircle size={18} />} label="Expired" count={stats.expired}
            active={currentFilters.filter === 'expired'} {...shared}
          />
        </NavSection>

        {stats.locations.length > 0 && (
          <NavSection title="Locations" colors={colors} collapsible defaultOpen>
            {stats.locations.map(({ name, count }) => (
              <NavFilterRow
                key={name}
                onClick={() => { onNavigate('/inventory'); onFilterChange({ ...clearFilters, location: name }); }}
                icon={getEmojiForLocation(name)} label={name} count={count}
                active={currentFilters.location === name} {...shared}
              />
            ))}
          </NavSection>
        )}

        {stats.categories.length > 0 && (
          <NavSection title="Categories" colors={colors} collapsible defaultOpen>
            {stats.categories.map(({ name, count }) => (
              <NavFilterRow
                key={name}
                onClick={() => { onNavigate('/inventory'); onFilterChange({ ...clearFilters, category: name }); }}
                icon={getEmojiForCategory(name)} label={name} count={count}
                active={currentFilters.category === name} {...shared}
              />
            ))}
          </NavSection>
        )}
      </div>

      <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
        <button
          id="tour-add-item"
          type="button"
          onClick={() => onNavigate('/add')}
          style={{ width: '100%', minHeight: ROW_MIN_HEIGHT, background: gradient.primary, color: colors.onPrimary, border: 'none', padding: '14px', borderRadius: borderRadius.lg, fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, boxShadow: shadows.large, fontFamily: 'inherit' }}
        >
          <Plus size={20} aria-hidden="true" />
          <span>Add New Item</span>
        </button>
      </div>
    </nav>
  );
}

function NavSection({ title, children, colors, collapsible = false, defaultOpen = true }: NavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headingStyle = {
    fontSize: '12px', fontWeight: 600, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    marginBottom: isOpen ? spacing.sm : 0,
    padding: `0 ${spacing.sm}`, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
    background: 'none', border: 'none', fontFamily: 'inherit',
    cursor: collapsible ? 'pointer' : 'default',
    userSelect: 'none' as const,
    minHeight: collapsible ? 32 : undefined,
  };

  return (
    <div style={{ marginBottom: spacing.xl }}>
      {collapsible ? (
        <button type="button" onClick={() => setIsOpen(o => !o)} aria-expanded={isOpen} style={headingStyle}>
          <span>{title}</span>
          <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <ChevronDown size={14} />
          </span>
        </button>
      ) : (
        <h2 style={{ ...headingStyle, margin: `0 0 ${isOpen ? spacing.sm : 0} 0` }}>{title}</h2>
      )}
      {isOpen && children}
    </div>
  );
}

export default Sidebar;
