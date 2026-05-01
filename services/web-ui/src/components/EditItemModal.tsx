import { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { formatDateForInput } from '../utils/dateUtils';
import { validateItem } from '../utils/validators';
import { useTheme } from '../context/ThemeContext';
import type { Item, CategoryOption } from '../types';

interface FormData {
  name: string;
  brand: string;
  category: string;
  location: string;
  quantity: number;
  expiry_date: string;
  notes: string;
}

interface EditItemModalProps {
  item: Item;
  onClose: () => void;
  onSave: (id: number | string, data: Partial<Item>) => Promise<void>;
  locations: string[];
  categories: string[];
  categoryObjects?: CategoryOption[];
}

const errorStyle = { color: '#dc2626', fontSize: '12px', marginTop: '4px' };

export function EditItemModal({ item, onClose, onSave, locations, categories, categoryObjects }: EditItemModalProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const [formData, setFormData] = useState<FormData>({ name: '', brand: '', category: '', location: '', quantity: 1, expiry_date: '', notes: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setFormData({ name: item.name || '', brand: item.brand || '', category: item.category || '', location: item.location || '', quantity: item.quantity || 1, expiry_date: formatDateForInput(item.expiry_date), notes: item.notes || '' });
      setFieldErrors({});
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid, errors } = validateItem(formData);
    if (!isValid) { setFieldErrors(errors); return; }
    setFieldErrors({});
    await onSave(item.id, formData);
    onClose();
  };

  if (!item) return null;

  const borderFor = (field: string) => `2px solid ${fieldErrors[field] ? '#dc2626' : colors.border}`;
  const inputStyle = (field: string) => ({ width: '100%', padding: spacing.md, borderRadius: borderRadius.md, border: borderFor(field), backgroundColor: colors.background, color: colors.textPrimary });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: colors.card, borderRadius: borderRadius.xl, padding: spacing.xl, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: colors.textPrimary }}>Edit Item</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: spacing.xs }}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={inputStyle('name')} />
            {fieldErrors.name && <p style={errorStyle}>{fieldErrors.name}</p>}
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Brand</label>
            <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} style={{ width: '100%', padding: spacing.md, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, backgroundColor: colors.background, color: colors.textPrimary }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing.md, marginBottom: spacing.md }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Location</label>
              <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={inputStyle('location')}>
                <option value="">Select...</option>
                {formData.location && !locations.includes(formData.location) && <option key={formData.location} value={formData.location}>{formData.location}</option>}
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              {fieldErrors.location && <p style={errorStyle}>{fieldErrors.location}</p>}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={inputStyle('category')}>
                <option value="">Select...</option>
                {formData.category && !categories.includes(formData.category) && <option key={formData.category} value={formData.category}>{formData.category}</option>}
                {(categoryObjects ?? categories.map(c => ({ name: c, emoji: '📦' }))).map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.emoji} {cat.name}</option>
                ))}
              </select>
              {fieldErrors.category && <p style={errorStyle}>{fieldErrors.category}</p>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing.md, marginBottom: spacing.md }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Quantity</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))} style={{ padding: spacing.sm, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, background: colors.background, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textPrimary }}><Minus size={16} /></button>
                <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })} min="1" style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, border: borderFor('quantity'), backgroundColor: colors.background, color: colors.textPrimary, textAlign: 'center' }} />
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))} style={{ padding: spacing.sm, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, background: colors.background, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textPrimary }}><Plus size={16} /></button>
              </div>
              {fieldErrors.quantity && <p style={errorStyle}>{fieldErrors.quantity}</p>}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Expiry Date</label>
              <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} style={inputStyle('expiry_date')} />
              {fieldErrors.expiry_date && <p style={errorStyle}>{fieldErrors.expiry_date}</p>}
            </div>
          </div>
          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} style={{ width: '100%', padding: spacing.md, borderRadius: borderRadius.md, border: borderFor('notes'), backgroundColor: colors.background, color: colors.textPrimary, resize: 'vertical' }} />
            {fieldErrors.notes && <p style={errorStyle}>{fieldErrors.notes}</p>}
          </div>
          <div style={{ display: 'flex', gap: spacing.md }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, background: 'transparent', color: colors.textPrimary, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, border: 'none', background: colors.primary, color: colors.textPrimary, fontWeight: '600', cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditItemModal;
