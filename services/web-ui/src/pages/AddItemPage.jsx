// Add/Edit Item Page - Supports both modes
import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { useLocations } from '../hooks/useLocations';
import { getDefaultLocations, getDefaultCategories } from '../defaults';

export function AddItemPage({ onBack, isDark }) {
  const colors = getColors(isDark);
  const { items, addItem, editItem } = useItems();
  const { locations: apiLocations, categories: apiCategories } = useLocations();
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    brand: '',
    quantity: 1,
    location: '',
    category: '',
    expiry_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const locations = apiLocations.length > 0 ? apiLocations : getDefaultLocations();
  const categories = apiCategories.length > 0 ? apiCategories : getDefaultCategories();

  // Check for edit mode on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id && items.length > 0) {
      const item = items.find(i => i.id === parseInt(id));
      if (item) {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
          name: item.name || '',
          barcode: item.barcode || '',
          brand: item.brand || '',
          quantity: item.quantity || 1,
          location: item.location || '',
          category: item.category || '',
          expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
          notes: item.notes || '',
        });
      }
    }
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isEditing && editId) {
        await editItem(editId, formData);
        alert('Item updated successfully!');
      } else {
        await addItem(formData);
        alert('Item added successfully!');
      }
      onBack();
    } catch (error) {
      alert(`Failed to ${isEditing ? 'update' : 'add'} item: ` + error.message);
    } finally {
      setSaving(false);
    }
  };

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Item Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} required style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Barcode</label>
            <input type="text" value={formData.barcode} onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Brand</label>
            <input type="text" value={formData.brand} onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Quantity *</label>
            <input type="number" value={formData.quantity} onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))} required min="1" style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Location *</label>
            <select value={formData.location} onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))} required style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }}>
              <option value="">Select location</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Category *</label>
            <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} required style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }}>
              <option value="">Select category</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Expiry Date</label>
            <input type="date" value={formData.expiry_date} onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))} style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px' }} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary }}>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows="3" style={{ width: '100%', padding: spacing.md, border: `2px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: '15px', fontFamily: 'inherit' }} />
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