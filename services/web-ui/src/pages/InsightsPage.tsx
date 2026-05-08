import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows, getGradient } from '../colors';
import { useItems } from '../hooks/useItems';
import { getExpiryStatus } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';

interface InsightStats {
  total_items: number;
  total_quantity: number;
  locations_count: number;
  categories_count: number;
  expiring_soon: number;
  manually_added_count: number;
}

interface BreakdownEntry {
  count: number;
  quantity: number;
}

interface ExpiryBreakdown {
  expired: number;
  expiringSoon: number;
  fresh: number;
  noDate: number;
}

interface MetricCardProps {
  icon: string;
  value: number;
  label: string;
  colors: ReturnType<typeof getColors>;
  gradient: string;
}

interface LegendItemProps {
  color: string;
  label: string;
  colors: ReturnType<typeof getColors>;
}

interface BreakdownRowProps {
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  colors: ReturnType<typeof getColors>;
  gradient: ReturnType<typeof getGradient>;
}

interface EntryMethodCardProps {
  icon: string;
  value: number;
  label: string;
  colors: ReturnType<typeof getColors>;
}

interface WasteWatchEntry {
  displayName: string;
  count: number;
  maxDaysOverdue: number;
  category: string;
}

export function InsightsPage() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);
  const shadows = getShadows(isDark);
  const { items, loading } = useItems();
  const [stats, setStats] = useState<InsightStats>({ total_items: 0, total_quantity: 0, locations_count: 0, categories_count: 0, expiring_soon: 0, manually_added_count: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState<[string, BreakdownEntry][]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<[string, BreakdownEntry][]>([]);
  const [expiryBreakdown, setExpiryBreakdown] = useState<ExpiryBreakdown>({ expired: 0, expiringSoon: 0, fresh: 0, noDate: 0 });
  const [wasteWatch, setWasteWatch] = useState<[string, WasteWatchEntry][]>([]);

  useEffect(() => {
    if (items.length > 0) calculateStats();
  }, [items]);

  const calculateStats = () => {
    const today = new Date();
    const oneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    let expiringSoon = 0, totalQuantity = 0, manuallyAddedCount = 0;
    const uniqueLocations = new Set<string>();
    const uniqueCategories = new Set<string>();
    const categoryMap: Record<string, BreakdownEntry> = {};
    const locationMap: Record<string, BreakdownEntry> = {};
    let expired = 0, expiringSoonCount = 0, fresh = 0, noDate = 0;

    items.forEach((item) => {
      totalQuantity += item.quantity || 1;
      if (item.manually_added) manuallyAddedCount++;
      if (item.location) {
        uniqueLocations.add(item.location);
        if (!locationMap[item.location]) locationMap[item.location] = { count: 0, quantity: 0 };
        locationMap[item.location].count += 1;
        locationMap[item.location].quantity += item.quantity || 1;
      }
      if (item.category) {
        uniqueCategories.add(item.category);
        if (!categoryMap[item.category]) categoryMap[item.category] = { count: 0, quantity: 0 };
        categoryMap[item.category].count += 1;
        categoryMap[item.category].quantity += item.quantity || 1;
      }
      if (item.expiry_date) {
        const expiryDate = new Date(item.expiry_date);
        const status = getExpiryStatus(item.expiry_date);
        if (status === 'expired') { expired++; }
        else if (status === 'critical' || status === 'warning') {
          expiringSoonCount++;
          if (expiryDate >= today && expiryDate <= oneWeek) expiringSoon++;
        } else { fresh++; }
      } else { noDate++; }
    });

    const wasteMap: Record<string, WasteWatchEntry> = {};
    items.forEach((item) => {
      if (!item.expiry_date) return;
      const expiry = new Date(item.expiry_date);
      if (expiry >= today) return;
      const daysOverdue = Math.floor((today.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));
      const key = item.name.trim().toLowerCase();
      if (!wasteMap[key]) wasteMap[key] = { displayName: item.name, count: 0, maxDaysOverdue: 0, category: item.category || 'Uncategorized' };
      wasteMap[key].count += 1;
      wasteMap[key].maxDaysOverdue = Math.max(wasteMap[key].maxDaysOverdue, daysOverdue);
    });
    const sortedWaste = Object.entries(wasteMap)
      .sort((a, b) => b[1].count - a[1].count || b[1].maxDaysOverdue - a[1].maxDaysOverdue)
      .slice(0, 5);

    setStats({ total_items: items.length, total_quantity: totalQuantity, locations_count: uniqueLocations.size, categories_count: uniqueCategories.size, expiring_soon: expiringSoon, manually_added_count: manuallyAddedCount });
    setCategoryBreakdown(Object.entries(categoryMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5));
    setLocationBreakdown(Object.entries(locationMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5));
    setExpiryBreakdown({ expired, expiringSoon: expiringSoonCount, fresh, noDate });
    setWasteWatch(sortedWaste);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: colors.background }}>
        <img src="/pantryPal.png" alt="Loading..." style={{ width: '48px', height: '48px' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.xl, maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: spacing.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <TrendingUp size={32} style={{ color: colors.primary }} />
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Insights</h1>
        </div>
        <p style={{ fontSize: '16px', color: colors.textSecondary, margin: 0 }}>Overview of your pantry analytics and statistics</p>
      </div>

      <div style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>OVERVIEW</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg }}>
          <MetricCard icon="📦" value={stats.total_items} label="Items" colors={colors} gradient="linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(192, 132, 252, 0.2))" />
          <MetricCard icon="#️⃣" value={stats.total_quantity} label="Quantity" colors={colors} gradient="linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(48, 209, 88, 0.2))" />
          <MetricCard icon="⚠️" value={stats.expiring_soon} label="Expiring" colors={colors} gradient="linear-gradient(135deg, rgba(255, 149, 0, 0.2), rgba(255, 159, 10, 0.2))" />
          <MetricCard icon="📍" value={stats.locations_count} label="Locations" colors={colors} gradient="linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(251, 191, 36, 0.2))" />
        </div>
      </div>

      <div style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>EXPIRY STATUS</h2>
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, boxShadow: shadows.medium }}>
          <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: spacing.lg, gap: '2px' }}>
            {expiryBreakdown.fresh > 0 && <div style={{ flex: expiryBreakdown.fresh, background: 'linear-gradient(135deg, #34c759, #30d158)', minWidth: '2px' }} />}
            {expiryBreakdown.expiringSoon > 0 && <div style={{ flex: expiryBreakdown.expiringSoon, background: 'linear-gradient(135deg, #ff9500, #ff9f0a)', minWidth: '2px' }} />}
            {expiryBreakdown.expired > 0 && <div style={{ flex: expiryBreakdown.expired, background: 'linear-gradient(135deg, #ff3b30, #ff453a)', minWidth: '2px' }} />}
            {expiryBreakdown.noDate > 0 && <div style={{ flex: expiryBreakdown.noDate, background: colors.border, minWidth: '2px' }} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
            <LegendItem color="#34c759" label={`Fresh (${expiryBreakdown.fresh})`} colors={colors} />
            <LegendItem color="#ff9500" label={`Soon (${expiryBreakdown.expiringSoon})`} colors={colors} />
            <LegendItem color="#ff3b30" label={`Expired (${expiryBreakdown.expired})`} colors={colors} />
            <LegendItem color={colors.border} label={`No Date (${expiryBreakdown.noDate})`} colors={colors} />
          </div>
        </div>
      </div>

      {wasteWatch.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>WASTE WATCH</h2>
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: shadows.medium }}>
            {wasteWatch.map(([key, data], index) => (
              <div key={key}>
                {index > 0 && <div style={{ height: '1px', background: colors.border, marginLeft: '58px' }} />}
                <div style={ss.breakdownRow}>
                  <div style={ss.breakdownLeft}>
                    <span style={ss.breakdownIcon}>⏰</span>
                    <div style={ss.breakdownContent}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary, marginBottom: '2px' }}>{data.displayName}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
                        {data.count > 1
                          ? `${data.count} expired in pantry · ${data.maxDaysOverdue}d overdue`
                          : `${data.maxDaysOverdue} day${data.maxDaysOverdue !== 1 ? 's' : ''} overdue`}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...ss.breakdownBadge, background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.25)' }}>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: '#ff3b30' }}>
                      {data.count > 1 ? `×${data.count}` : `${data.maxDaysOverdue}d`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: spacing.xl }}>
        <div>
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>TOP CATEGORIES</h2>
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: shadows.medium }}>
            {categoryBreakdown.length > 0 ? categoryBreakdown.map(([category, data], index) => (
              <div key={category}>
                {index > 0 && <div style={{ height: '1px', background: colors.border, marginLeft: '58px' }} />}
                <BreakdownRow icon="🏷️" title={category} subtitle={`Qty: ${data.quantity}`} count={data.count} colors={colors} gradient={gradient} />
              </div>
            )) : (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>No categories yet</div>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>TOP LOCATIONS</h2>
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: shadows.medium }}>
            {locationBreakdown.length > 0 ? locationBreakdown.map(([location, data], index) => (
              <div key={location}>
                {index > 0 && <div style={{ height: '1px', background: colors.border, marginLeft: '58px' }} />}
                <BreakdownRow icon="📍" title={location} subtitle={`Qty: ${data.quantity}`} count={data.count} colors={colors} gradient={gradient} />
              </div>
            )) : (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>No locations yet</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>ENTRY METHODS</h2>
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, boxShadow: shadows.medium }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <EntryMethodCard icon="✏️" value={stats.manually_added_count} label="Manual" colors={colors} />
            <div style={{ width: '1px', height: '80px', background: colors.border }} />
            <EntryMethodCard icon="📷" value={stats.total_items - stats.manually_added_count} label="Scanned" colors={colors} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ss = {
  legendRow: { display: 'flex' as const, alignItems: 'center' as const, gap: spacing.sm },
  legendDot: { width: '10px', height: '10px', borderRadius: '5px' },
  breakdownRow: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '14px' },
  breakdownLeft: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', flex: 1 },
  breakdownIcon: { fontSize: '24px', width: '32px' },
  breakdownContent: { flex: 1 },
  breakdownBadge: { padding: '6px 12px', borderRadius: '12px', minWidth: '40px', textAlign: 'center' as const },
  entryMethod: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, gap: spacing.md },
  entryMethodIcon: { width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(192, 132, 252, 0.2))', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, fontSize: '32px' },
};

function MetricCard({ icon, value, label, colors, gradient }: MetricCardProps) {
  const { isDark } = useTheme();
  const shadows = getShadows(isDark);
  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, boxShadow: shadows.medium, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.md }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function LegendItem({ color, label, colors }: LegendItemProps) {
  return (
    <div style={ss.legendRow}>
      <div style={{ ...ss.legendDot, background: color }} />
      <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>{label}</span>
    </div>
  );
}

function BreakdownRow({ icon, title, subtitle, count, colors, gradient }: BreakdownRowProps) {
  return (
    <div style={ss.breakdownRow}>
      <div style={ss.breakdownLeft}>
        <span style={ss.breakdownIcon}>{icon}</span>
        <div style={ss.breakdownContent}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary, marginBottom: '2px' }}>{title}</div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ ...ss.breakdownBadge, background: `${colors.primary}26` }}>
        <span style={{ fontSize: '14px', fontWeight: '900', color: colors.primary }}>{count}</span>
      </div>
    </div>
  );
}

function EntryMethodCard({ icon, value, label, colors }: EntryMethodCardProps) {
  return (
    <div style={ss.entryMethod}>
      <div style={ss.entryMethodIcon}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '900', color: colors.textPrimary, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export default InsightsPage;
