import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useToast } from '../components/Toast';
import { useItems } from '../hooks/useItems';
import { useLocations } from '../hooks/useLocations';
import { getDefaultLocationNames, getDefaultCategories, getDefaultCategoryNames } from '../defaults';
import { validateItem } from '../utils/validators';
import { useTheme } from '../context/ThemeContext';

interface FormData {
  name: string;
  barcode: string;
  brand: string;
  quantity: number;
  location: string;
  category: string;
  expiry_date: string;
  notes: string;
}

interface AddItemPageProps {
  onBack: () => void;
}

const errorStyle = { color: '#dc2626', fontSize: '12px', marginTop: '4px' };

export function AddItemPage({ onBack }: AddItemPageProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const toast = useToast();
  const { items, addItem, editItem } = useItems();
  const { locations: apiLocations, categoryObjects: apiCategoryObjects } = useLocations();
  const [formData, setFormData] = useState<FormData>({ name: '', barcode: '', brand: '', quantity: 1, location: '', category: '', expiry_date: '', notes: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const locations = apiLocations.length > 0 ? apiLocations : getDefaultLocationNames();
  const categoryObjects = apiCategoryObjects.length > 0 ? apiCategoryObjects : getDefaultCategories();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && items.length > 0) {
      const item = items.find(i => i.id === parseInt(id));
      if (item) {
        setIsEditing(true);
        setEditId(item.id as number);
        setFormData({ name: item.name || '', barcode: item.barcode || '', brand: item.brand || '', quantity: item.quantity || 1, location: item.location || '', category: item.category || '', expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '', notes: item.notes || '' });
      }
    }
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid, errors, warnings } = validateItem(formData);
    if (!isValid) { setFieldErrors(errors); return; }
    setFieldErrors({});
    if (warnings.expiry_date) toast.warning(warnings.expiry_date);
    try {
      setSaving(true);
      if (isEditing && editId) {
        await editItem(editId, formData);
        toast.success('Item updated successfully!');
      } else {
        await addItem(formData);
        toast.success('Item added successfully!');
      }
      onBack();
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'add'} item: ` + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const borderFor = (field: string) => `2px solid ${fieldErrors[field] ? '#dc2626' : colors.border}`;

  return (
    <div style={{ padding: `${spacing.xl} ${spacing.xxl}`, maxWidth: '800px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary, marginBottom: spacing.lg, fontSize: '14px', padding: spacing.sm }}>
        <ArrowLeft size={18} />
        Back to Inventory
      </button>

      <h1 style={{ marginBottom: spacing.xl, fontSize: '24px', fontWeight: '700', color: colors.textPrimary }}>
        {isEditing ? 'Edit Item' : 'Add New Item'}
      </h1>

      <form onSubmit={handleSubmit} style={{ background: colors.card, padding: spacing.xxl, borderRadius: borderRadius.xl, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing.lg }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Item Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: borderFor('name'), borderRadius: borderRadius.md, fontSize: '15px' }} />
            {fieldErrors.name && <p style={errorStyle}>{fieldErrors.name}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Barcode</label>
            <input type="text" value={formData.barcode} onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: borderFor('barcode'), borderRadius: borderRadius.md, fontSize: '15px' }} />
            {fieldErrors.barcode && <p style={errorStyle}>{fieldErrors.barcode}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Brand</label>
            <input type="text" value={formData.brand} onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Quantity *</label>
            <input type="number" value={formData.quantity} onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))} min="1" style={{ width: '100%', padding: spacing.md, border: borderFor('quantity'), borderRadius: borderRadius.md, fontSize: '15px' }} />
            {fieldErrors.quantity && <p style={errorStyle}>{fieldErrors.quantity}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Location *</label>
            <select value={formData.location} onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: borderFor('location'), borderRadius: borderRadius.md, fontSize: '15px' }}>
              <option value="">Select location</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            {fieldErrors.location && <p style={errorStyle}>{fieldErrors.location}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Category *</label>
            <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: borderFor('category'), borderRadius: borderRadius.md, fontSize: '15px' }}>
              <option value="">Select category</option>
              {categoryObjects.map(cat => <option key={cat.name} value={cat.name}>{cat.emoji} {cat.name}</option>)}
            </select>
            {fieldErrors.category && <p style={errorStyle}>{fieldErrors.category}</p>}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Expiry Date</label>
            <input type="date" value={formData.expiry_date} onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: borderFor('expiry_date'), borderRadius: borderRadius.md, fontSize: '15px' }} />
            {fieldErrors.expiry_date && <p style={errorStyle}>{fieldErrors.expiry_date}</p>}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} style={{ width: '100%', padding: spacing.md, border: borderFor('notes'), borderRadius: borderRadius.md, fontSize: '15px', fontFamily: 'inherit' }} />
            {fieldErrors.notes && <p style={errorStyle}>{fieldErrors.notes}</p>}
          </div>
        </div>

        <button type="submit" disabled={saving} style={{ marginTop: spacing.xl, width: '100%', padding: spacing.lg, background: colors.primary, border: 'none', borderRadius: borderRadius.md, color: 'white', fontSize: '16px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: saving ? 0.6 : 1 }}>
          <Save size={20} />
          {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
        </button>
      </form>
    </div>
  );
}

export default AddItemPage;
