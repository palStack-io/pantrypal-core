import { Edit, Trash2, MapPin, Plus, Minus, QrCode, Check } from 'lucide-react';
import { getColors, borderRadius, spacing, getShadows, getFreshness, typography } from '../colors';
import { getExpiryBadgeText, getFreshnessState, getDaysUntilExpiry } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { getEmojiForCategory } from '../defaults';
import type { Item } from '../types';

interface ItemCardProps {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onQRLabel?: (item: Item) => void;
  onSelect?: (item: Item) => void;
  isSelected?: boolean;
  onQuantityChange?: (id: number | string, qty: number) => void;
}

/**
 * Inventory card.
 *
 * Previously every fact on the card carried the same weight — name, location,
 * category and expiry were four rows of 14px grey, so the one thing the product
 * exists to tell you (how long you have) was the smallest element on it.
 *
 * Now the card is organised around time: a coloured rail down the leading edge
 * carries the expiry state, and the day count is the largest type in the card.
 * A grid of forty items reads as a pattern before you read a single word.
 * Location and category collapse onto one line to pay for the space.
 */
export function ItemCard({ item, onEdit, onDelete, onQRLabel, onSelect, isSelected, onQuantityChange }: ItemCardProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const shadows = getShadows(isDark);
  const fresh = getFreshness(isDark);

  const state = getFreshnessState(item.expiry_date);
  const tone = fresh[state];
  const days = getDaysUntilExpiry(item.expiry_date);

  // The day count is split from its unit so the number can carry the weight and
  // the word stays quiet. Past-date items count up, not down.
  const bigNumber = days === null ? null : Math.abs(days);
  const unitLabel =
    days === null ? 'No expiry date'
      : days < 0 ? `day${Math.abs(days) === 1 ? '' : 's'} ago`
      : days === 0 ? 'Expires today'
      : `day${days === 1 ? '' : 's'} left`;

  const iconBtn = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: spacing.xs,
    display: 'flex',
    borderRadius: borderRadius.sm,
    color: colors.textTertiary,
  } as const;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5px 1fr',
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.small,
        border: isSelected ? `1.5px solid ${colors.primary}` : `1px solid ${colors.border}`,
        overflow: 'hidden',
        transition: 'transform 0.18s, box-shadow 0.18s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadows.medium; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = shadows.small; }}
      onClick={() => onSelect && onSelect(item)}
    >
      {/* The freshness rail. Colour is the state; it is the card's primary datum
          and the reason a dense grid is scannable. */}
      <div aria-hidden="true" style={{ background: tone.fg }} />

      <div style={{ padding: spacing.md, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
          {onSelect && (
            /* Was a <div role="checkbox"> with no tabIndex, no handler and
               no name -- it announced itself as a checkbox that could not be
               reached or operated, which is worse than plain text. The click
               lived on the card, so keyboard users had no way in at all. */
            <button
              type="button"
              role="checkbox"
              aria-checked={!!isSelected}
              aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
              onClick={(e) => { e.stopPropagation(); onSelect(item); }}
              style={{ width: '24px', height: '24px', padding: 0, cursor: 'pointer', flexShrink: 0, marginTop: '7px', borderRadius: borderRadius.sm, border: `1.5px solid ${isSelected ? colors.primary : colors.borderDark}`, background: isSelected ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isSelected && <Check size={13} color="#fff" strokeWidth={3} aria-hidden="true" />}
            </button>
          )}

          {/* Category disc. The emoji set is unchanged — swapping it for a drawn
              icon family is a separate, larger change. */}
          <div aria-hidden="true" style={{ width: '38px', height: '38px', flex: '0 0 38px', borderRadius: borderRadius.md, background: colors.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            {getEmojiForCategory(item.category ?? '')}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, letterSpacing: typography.tracking.snug, lineHeight: typography.leading.tight, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
            <div style={{ fontSize: typography.size.sm, color: colors.textSecondary, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.location || 'No location'}{item.category ? ` · ${item.category}` : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
            {item.manually_added && onQRLabel && (
              <button onClick={(e) => { e.stopPropagation(); onQRLabel(item); }} aria-label={item.qr_label_generated ? `View QR label for ${item.name}` : `Get QR label for ${item.name}`} style={{ ...iconBtn, color: item.qr_label_generated ? colors.primary : colors.textTertiary }}>
                <QrCode size={16} />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} aria-label={`Edit ${item.name}`} style={iconBtn}>
              <Edit size={16} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} aria-label={`Delete ${item.name}`} style={{ ...iconBtn, color: fresh.urgent.fg }}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Expiry, promoted from a 12px pill to the loudest line on the card. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: spacing.md }}>
          {bigNumber !== null && (
            <span style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, letterSpacing: typography.tracking.tight, color: tone.fg, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {bigNumber}
            </span>
          )}
          <span
            style={{ fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: bigNumber === null ? colors.textTertiary : tone.fg }}
            title={getExpiryBadgeText(item.expiry_date)}
          >
            {unitLabel}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
          <span style={{ fontSize: typography.size.sm, color: colors.textSecondary }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: colors.accentBg, borderRadius: borderRadius.full, padding: '3px' }}>
            {onQuantityChange && (
              <button onClick={(e) => { e.stopPropagation(); onQuantityChange(item.id, Math.max(1, (item.quantity || 1) - 1)); }} style={{ width: '26px', height: '26px', border: 'none', borderRadius: borderRadius.full, background: 'transparent', cursor: 'pointer', color: colors.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Decrease quantity" aria-label="Decrease quantity">
                <Minus size={14} />
              </button>
            )}
            <span style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, minWidth: '22px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{item.quantity || 1}</span>
            {onQuantityChange && (
              <button onClick={(e) => { e.stopPropagation(); onQuantityChange(item.id, (item.quantity || 1) + 1); }} style={{ width: '26px', height: '26px', border: 'none', borderRadius: borderRadius.full, background: 'transparent', cursor: 'pointer', color: colors.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Increase quantity" aria-label="Increase quantity">
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>

        {item.notes && <div style={{ marginTop: spacing.sm, fontSize: typography.size.xs, color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes}</div>}
      </div>
    </div>
  );
}

export default ItemCard;
