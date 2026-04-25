import { Trash2, Download, X, ShoppingCart } from 'lucide-react';
import { colors, borderRadius, spacing, shadows } from '../colors';

interface BulkActionsProps {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
  onAddToShoppingList: () => void;
}

export function BulkActions({ selectedCount, onDelete, onExport, onClear, onAddToShoppingList }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: spacing.xl, left: '50%', transform: 'translateX(-50%)',
        backgroundColor: colors.textPrimary, color: 'white',
        borderRadius: borderRadius.lg, boxShadow: shadows.xl,
        padding: spacing.lg, display: 'flex', alignItems: 'center', gap: spacing.lg, zIndex: 100,
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '500' }}>
        {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
      </div>
      <div style={{ display: 'flex', gap: spacing.sm }}>
        <button onClick={onAddToShoppingList} style={{ background: colors.success, border: 'none', cursor: 'pointer', padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', gap: spacing.xs, color: 'white', fontSize: '14px', fontWeight: '500' }}>
          <ShoppingCart size={16} /> Add to Shopping List
        </button>
        <button onClick={onExport} style={{ background: colors.info, border: 'none', cursor: 'pointer', padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', gap: spacing.xs, color: 'white', fontSize: '14px', fontWeight: '500' }}>
          <Download size={16} /> Export
        </button>
        <button onClick={onDelete} style={{ background: colors.danger, border: 'none', cursor: 'pointer', padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', gap: spacing.xs, color: 'white', fontSize: '14px', fontWeight: '500' }}>
          <Trash2 size={16} /> Delete
        </button>
        <button onClick={onClear} style={{ background: 'none', border: `1px solid rgba(255,255,255,0.3)`, cursor: 'pointer', padding: spacing.sm, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', color: 'white' }}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default BulkActions;
