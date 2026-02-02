import { useState, useEffect } from 'react';
import { TrendingUp, Package, AlertTriangle, MapPin, Tag, Edit, Camera } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows, getGradient } from '../colors';
import { useItems } from '../hooks/useItems';
import { getExpiryStatus } from '../utils/dateUtils';

export function InsightsPage({ isDark }) {
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);
  const shadows = getShadows(isDark);
  const { items, loading } = useItems();
  const [stats, setStats] = useState({
    total_items: 0,
    total_quantity: 0,
    locations_count: 0,
    categories_count: 0,
    expiring_soon: 0,
    manually_added_count: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [locationBreakdown, setLocationBreakdown] = useState([]);
  const [expiryBreakdown, setExpiryBreakdown] = useState({
    expired: 0,
    expiringSoon: 0,
    fresh: 0,
    noDate: 0,
  });

  useEffect(() => {
    if (items.length > 0) {
      calculateStats();
    }
  }, [items]);

  const calculateStats = () => {
    const today = new Date();
    const oneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let expiringSoon = 0;
    let totalQuantity = 0;
    let manuallyAddedCount = 0;
    const uniqueLocations = new Set();
    const uniqueCategories = new Set();
    const categoryMap = {};
    const locationMap = {};
    let expired = 0;
    let expiringSoonCount = 0;
    let fresh = 0;
    let noDate = 0;

    items.forEach((item) => {
      totalQuantity += item.quantity || 1;
      if (item.manually_added) manuallyAddedCount++;
      if (item.location) {
        uniqueLocations.add(item.location);
        if (!locationMap[item.location]) {
          locationMap[item.location] = { count: 0, quantity: 0 };
        }
        locationMap[item.location].count += 1;
        locationMap[item.location].quantity += item.quantity || 1;
      }
      if (item.category) {
        uniqueCategories.add(item.category);
        if (!categoryMap[item.category]) {
          categoryMap[item.category] = { count: 0, quantity: 0 };
        }
        categoryMap[item.category].count += 1;
        categoryMap[item.category].quantity += item.quantity || 1;
      }

      if (item.expiry_date) {
        const expiryDate = new Date(item.expiry_date);
        const status = getExpiryStatus(item.expiry_date);

        if (status === 'expired') {
          expired++;
        } else if (status === 'critical' || status === 'warning') {
          expiringSoonCount++;
          if (expiryDate >= today && expiryDate <= oneWeek) {
            expiringSoon++;
          }
        } else {
          fresh++;
        }
      } else {
        noDate++;
      }
    });

    const calculatedStats = {
      total_items: items.length,
      total_quantity: totalQuantity,
      locations_count: uniqueLocations.size,
      categories_count: uniqueCategories.size,
      expiring_soon: expiringSoon,
      manually_added_count: manuallyAddedCount,
    };

    const categoryBreakdownData = Object.entries(categoryMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const locationBreakdownData = Object.entries(locationMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    setStats(calculatedStats);
    setCategoryBreakdown(categoryBreakdownData);
    setLocationBreakdown(locationBreakdownData);
    setExpiryBreakdown({
      expired,
      expiringSoon: expiringSoonCount,
      fresh,
      noDate,
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: colors.background }}>
        <img src="/pantryPal.png" alt="Loading..." style={{ width: '48px', height: '48px' }} />
      </div>
    );
  }

  const totalExpiryItems = expiryBreakdown.expired + expiryBreakdown.expiringSoon + expiryBreakdown.fresh + expiryBreakdown.noDate;

  return (
    <div style={{ padding: spacing.xl, maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <TrendingUp size={32} style={{ color: colors.primary }} />
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>
            Insights
          </h1>
        </div>
        <p style={{ fontSize: '16px', color: colors.textSecondary, margin: 0 }}>
          Overview of your pantry analytics and statistics
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>
          OVERVIEW
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg }}>
          <MetricCard
            icon="📦"
            value={stats.total_items}
            label="Items"
            colors={colors}
            gradient="linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(192, 132, 252, 0.2))"
            isDark={isDark}
          />
          <MetricCard
            icon="#️⃣"
            value={stats.total_quantity}
            label="Quantity"
            colors={colors}
            gradient="linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(48, 209, 88, 0.2))"
            isDark={isDark}
          />
          <MetricCard
            icon="⚠️"
            value={stats.expiring_soon}
            label="Expiring"
            colors={colors}
            gradient="linear-gradient(135deg, rgba(255, 149, 0, 0.2), rgba(255, 159, 10, 0.2))"
            isDark={isDark}
          />
          <MetricCard
            icon="📍"
            value={stats.locations_count}
            label="Locations"
            colors={colors}
            gradient="linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(251, 191, 36, 0.2))"
            isDark={isDark}
          />
        </div>
      </div>

      {/* Expiry Status */}
      <div style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>
          EXPIRY STATUS
        </h2>
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, boxShadow: shadows.medium }}>
          <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: spacing.lg, gap: '2px' }}>
            {expiryBreakdown.fresh > 0 && (
              <div style={{ flex: expiryBreakdown.fresh, background: 'linear-gradient(135deg, #34c759, #30d158)', minWidth: '2px' }} />
            )}
            {expiryBreakdown.expiringSoon > 0 && (
              <div style={{ flex: expiryBreakdown.expiringSoon, background: 'linear-gradient(135deg, #ff9500, #ff9f0a)', minWidth: '2px' }} />
            )}
            {expiryBreakdown.expired > 0 && (
              <div style={{ flex: expiryBreakdown.expired, background: 'linear-gradient(135deg, #ff3b30, #ff453a)', minWidth: '2px' }} />
            )}
            {expiryBreakdown.noDate > 0 && (
              <div style={{ flex: expiryBreakdown.noDate, background: colors.border, minWidth: '2px' }} />
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
            <LegendItem color="#34c759" label={`Fresh (${expiryBreakdown.fresh})`} colors={colors} />
            <LegendItem color="#ff9500" label={`Soon (${expiryBreakdown.expiringSoon})`} colors={colors} />
            <LegendItem color="#ff3b30" label={`Expired (${expiryBreakdown.expired})`} colors={colors} />
            <LegendItem color={colors.border} label={`No Date (${expiryBreakdown.noDate})`} colors={colors} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: spacing.xl }}>
        {/* Top Categories */}
        <div>
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>
            TOP CATEGORIES
          </h2>
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: shadows.medium }}>
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.map(([category, data], index) => (
                <div key={category}>
                  {index > 0 && <div style={{ height: '1px', background: colors.border, marginLeft: '58px' }} />}
                  <BreakdownRow
                    icon="🏷️"
                    title={category}
                    subtitle={`Qty: ${data.quantity}`}
                    count={data.count}
                    colors={colors}
                    gradient={gradient}
                  />
                </div>
              ))
            ) : (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>
                No categories yet
              </div>
            )}
          </div>
        </div>

        {/* Top Locations */}
        <div>
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>
            TOP LOCATIONS
          </h2>
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, overflow: 'hidden', boxShadow: shadows.medium }}>
            {locationBreakdown.length > 0 ? (
              locationBreakdown.map(([location, data], index) => (
                <div key={location}>
                  {index > 0 && <div style={{ height: '1px', background: colors.border, marginLeft: '58px' }} />}
                  <BreakdownRow
                    icon="📍"
                    title={location}
                    subtitle={`Qty: ${data.quantity}`}
                    count={data.count}
                    colors={colors}
                    gradient={gradient}
                  />
                </div>
              ))
            ) : (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>
                No locations yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entry Methods */}
      <div style={{ marginTop: spacing.xl }}>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing.md }}>
          ENTRY METHODS
        </h2>
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, boxShadow: shadows.medium }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <EntryMethodCard
              icon="✏️"
              value={stats.manually_added_count}
              label="Manual"
              colors={colors}
            />
            <div style={{ width: '1px', height: '80px', background: colors.border }} />
            <EntryMethodCard
              icon="📷"
              value={stats.total_items - stats.manually_added_count}
              label="Scanned"
              colors={colors}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, colors, gradient, isDark }) {
  const shadows = getShadows(isDark);
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      boxShadow: shadows.medium,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.md,
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary, letterSpacing: '-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function LegendItem({ color, label, colors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: color }} />
      <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
        {label}
      </span>
    </div>
  );
}

function BreakdownRow({ icon, title, subtitle, count, colors, gradient }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <span style={{ fontSize: '24px', width: '32px' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary, marginBottom: '2px' }}>
            {title}
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
            {subtitle}
          </div>
        </div>
      </div>
      <div style={{
        padding: '6px 12px',
        borderRadius: '12px',
        background: `${colors.primary}26`,
        minWidth: '40px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '14px', fontWeight: '900', color: colors.primary }}>
          {count}
        </span>
      </div>
    </div>
  );
}

function EntryMethodCard({ icon, value, label, colors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.md }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(192, 132, 252, 0.2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '900', color: colors.textPrimary, letterSpacing: '-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

export default InsightsPage;
