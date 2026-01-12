// Dashboard page - main overview
import { useState, useEffect } from 'react';
import { Package, AlertTriangle, MapPin, Clock } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import ItemCard from '../components/ItemCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { colors, spacing } from '../colors';
import { useItems } from '../hooks/useItems';
import { useStats } from '../hooks/useStats';
import { getExpiringWithinDays, sortByExpiry } from '../utils/dateUtils';

export function DashboardPage({ onNavigate }) {
  const { items, loading, error } = useItems();
  const { stats } = useStats(items);
  const [expiringItems, setExpiringItems] = useState([]);

  useEffect(() => {
    if (items.length > 0) {
      const expiring = getExpiringWithinDays(items, 7);
      setExpiringItems(sortByExpiry(expiring).slice(0, 5));
    }
  }, [items]);

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: spacing.xl }}>
      <h1 style={{ marginBottom: spacing.xl, fontSize: '32px', fontWeight: 'bold' }}>Dashboard</h1>

      {error && <Alert type="error" message={error} />}

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: spacing.lg,
        marginBottom: spacing.xl 
      }}>
        <StatsCard icon={Package} label="Total Items" value={stats.totalItems} color={colors.primary} />
        <StatsCard icon={AlertTriangle} label="Expiring Soon" value={stats.expiringSoon} color={colors.warning} />
        <StatsCard icon={MapPin} label="Locations" value={stats.locations} color={colors.info} />
        <StatsCard icon={Clock} label="Expired" value={stats.expired} color={colors.danger} />
      </div>

      {/* Expiring Soon */}
      {expiringItems.length > 0 && (
        <div>
          <h2 style={{ marginBottom: spacing.lg, fontSize: '24px', fontWeight: 'bold' }}>
            Items Expiring Soon
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
            {expiringItems.map(item => (
              <ItemCard 
                key={item.id} 
                item={item}
                onEdit={() => onNavigate(`/item/${item.id}`)}
                onDelete={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginTop: spacing.xxl }}>
        <h2 style={{ marginBottom: spacing.lg, fontSize: '24px', fontWeight: 'bold' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('/add')}
            style={{
              background: colors.primary,
              border: 'none',
              padding: `${spacing.lg} ${spacing.xl}`,
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Add New Item
          </button>
          <button
            onClick={() => onNavigate('/inventory')}
            style={{
              background: colors.secondary,
              border: 'none',
              padding: `${spacing.lg} ${spacing.xl}`,
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            View All Items
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
