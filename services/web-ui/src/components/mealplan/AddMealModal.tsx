import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { getColors, spacing, borderRadius } from '../../colors';
import { getRecipes } from '../../api';
import { MEAL_SLOTS } from '../../utils/mealplan';
import { parseLocalDate } from '../../utils/dateUtils';
import type { MealSlot, NewMealEntry } from '../../types';

interface PickerRecipe {
  id: string | number;
  name: string;
  total_time?: number;
}

interface Props {
  open: boolean;
  date: string;          // YYYY-MM-DD
  slot: MealSlot;
  onClose: () => void;
  onAdd: (entry: NewMealEntry) => Promise<void>;
}

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export function AddMealModal({ open, date, slot: initialSlot, onClose, onAdd }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [recipes, setRecipes] = useState<PickerRecipe[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setSlot(initialSlot); setQuery(''); setNote(''); } }, [open, initialSlot]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadFailed(false);
    getRecipes(200, 0, 'name', 'asc')
      .then((res) => {
        if (cancelled) return;
        // the list route returns a bare array; tolerate a wrapped shape too
        const list = Array.isArray(res) ? res : ((res as unknown as { recipes?: PickerRecipe[] }).recipes ?? []);
        setRecipes(list as PickerRecipe[]);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const run = async (entry: NewMealEntry) => {
    setBusy(true);
    try { await onAdd(entry); onClose(); } finally { setBusy(false); }
  };

  const input = {
    width: '100%', boxSizing: 'border-box' as const, minHeight: '44px', padding: '0 14px', fontSize: '15px',
    borderRadius: borderRadius.lg, border: `1.5px solid ${colors.borderDark}`, background: colors.card, color: colors.textPrimary,
  };
  const label = { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '13px', fontWeight: 600, color: colors.textSecondary };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add a meal" width="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
          {parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>

        <label style={label}>
          Meal
          <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} style={input}>
            {MEAL_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
          </select>
        </label>

        <label style={label}>
          Search your recipes
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} style={input} />
        </label>

        <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadFailed && <div role="alert" style={{ color: colors.danger, fontSize: '14px' }}>Couldn't load your recipes</div>}
          {!loadFailed && shown.length === 0 && <div style={{ color: colors.textSecondary, fontSize: '14px' }}>No recipes match.</div>}
          {shown.map((r) => (
            <div key={String(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, background: colors.card }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                {r.total_time ? <div style={{ fontSize: '12px', color: colors.textSecondary }}>{r.total_time} min</div> : null}
              </div>
              <Button size="md" disabled={busy} onClick={() => run({ plan_date: date, slot, recipe_id: String(r.id) })}>Add</Button>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (note.trim()) void run({ plan_date: date, slot, title: note.trim() }); }}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <label style={label}>
            Or just type a note
            <input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Leftovers, takeout, dinner at Sam's" style={input} />
          </label>
          <div>
            <Button type="submit" variant="secondary" disabled={busy || !note.trim()}>Add note</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
