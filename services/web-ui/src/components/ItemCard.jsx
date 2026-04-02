// Item card component for displaying inventory items
import { Edit, Trash2, MapPin, Tag, Calendar, Plus, Minus } from 'lucide-react';
import { getColors, borderRadius, spacing, getShadows } from '../colors';
import { formatDate, getExpiryBadgeText, getExpiryColor } from '../utils/dateUtils';

export function ItemCard({ item, onEdit, onDelete, onSelect, isSelected, isDark, onQuantityChange }) {
  const colors = getColors(isDark);
  const shadows = getShadows(isDark);
  const expiryColor = getExpiryColor(item.expiry_date);
  const expiryBadge = getExpiryBadgeText(item.expiry_date);

  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.medium,
        padding: spacing.lg,
        border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = shadows.large;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadows.medium;
      }}
      onClick={() => onSelect && onSelect(item)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: spacing.md }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
            {item.name}
          </h3>
          {item.barcode && (
            <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: spacing.xs }}>
              {item.barcode}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing.xs,
              color: colors.textSecondary,
            }}
          >
            <Edit size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing.xs,
              color: colors.danger,
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, fontSize: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary }}>
          <MapPin size={16} />
          <span>{item.location || 'No location'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary }}>
          <Tag size={16} />
          <span>{item.category || 'No category'}</span>
        </div>
        {item.expiry_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <Calendar size={16} style={{ color: colors.textSecondary }} />
            <span
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                backgroundColor: expiryColor + '20',
                color: expiryColor,
                borderRadius: borderRadius.sm,
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {expiryBadge}
            </span>
          </div>
        )}
      </div>

      {/* Quantity */}
      <div
        style={{
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '14px', color: colors.textSecondary }}>Quantity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {onQuantityChange && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(item.id, Math.max(1, (item.quantity || 1) - 1));
              }}
              style={{
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.sm,
                padding: '6px',
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
          )}
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: colors.primary, minWidth: '30px', textAlign: 'center' }}>
            {item.quantity || 1}
          </span>
          {onQuantityChange && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(item.id, (item.quantity || 1) + 1);
              }}
              style={{
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.sm,
                padding: '6px',
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
          )}
        </div>
      </div>

      {item.notes && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: '12px',
            color: colors.textTertiary,
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.notes}
        </div>
      )}
    </div>
  );
}

export default ItemCard;
