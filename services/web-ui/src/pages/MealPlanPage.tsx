import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  createMealEntry, deleteMealEntry, getMealPlan, markMealCooked, mealPlanToShoppingList,
} from '../api';
import type { MealPlanEntry, MealSlot, NewMealEntry } from '../types';
import { parseLocalDate, toLocalISODate } from '../utils/dateUtils';
import {
  groupByDate, MEAL_SLOTS, monthGrid, rangeFor, shiftAnchor, startOfWeek, weekDays, type PlannerView,
} from '../utils/mealplan';
import { AddMealModal } from '../components/mealplan/AddMealModal';
import { ExportModal } from '../components/mealplan/ExportModal';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

export function MealPlanPage() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const toast = useToast();

  const [view, setView] = useState<PlannerView>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(() => toLocalISODate(new Date()));
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const week = useMemo(() => rangeFor('week', anchor), [anchor]);
  const month = useMemo(() => rangeFor('month', anchor), [anchor]);
  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const todayIso = toLocalISODate(new Date());

  const load = useCallback(async () => {
    try {
      setEntries(await getMealPlan(range.start, range.end));
    } catch {
      toast.error("Couldn't load your meal plan");
    } finally {
      setLoading(false);
    }
  // toast is stable enough here; refetch only when the visible range changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const title = view === 'week'
    ? `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[6], { month: 'short', day: 'numeric' })}`
    : fmt(anchor, { month: 'long', year: 'numeric' });
  const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => fmt(parseLocalDate(iso), opts);

  const addEntry = async (entry: NewMealEntry) => {
    try {
      await createMealEntry(entry);
      toast.success('Meal added');
      await load();
    } catch {
      toast.error("Couldn't add the meal");
      throw new Error('add failed');
    }
  };

  const removeEntry = async (e: MealPlanEntry) => {
    try { await deleteMealEntry(e.id); toast.success('Meal removed'); await load(); }
    catch { toast.error("Couldn't remove the meal"); }
  };

  const cookEntry = async (e: MealPlanEntry) => {
    try { await markMealCooked(e.id); toast.success('Marked cooked'); await load(); }
    catch { toast.error("Couldn't mark it cooked"); }
  };

  const addMissingToShopping = async () => {
    setBusy(true);
    try {
      const res = await mealPlanToShoppingList(range.start, range.end);
      toast.success(res.added ? `Added ${res.added} item${res.added === 1 ? '' : 's'} to your shopping list` : 'Nothing to add, you have everything planned.');
    } catch {
      toast.error("Couldn't update the shopping list");
    } finally {
      setBusy(false);
    }
  };

  const selectedEntries = byDate[selected] ?? [];
  const nothingPlanned = !loading && entries.length === 0;

  const chip = (e: MealPlanEntry) => (
    <div
      key={e.id}
      style={{
        padding: '3px 8px', borderRadius: '6px', fontSize: '12px', lineHeight: 1.3, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: colors.accentBg, color: colors.textPrimary,
        opacity: e.cooked_at ? 0.75 : 1,
      }}
      title={e.title}
    >
      {e.cooked_at ? <Check size={11} aria-label="Cooked" style={{ verticalAlign: '-1px' }} /> : <strong>{SLOT_LABEL[e.slot].charAt(0)}</strong>} · {e.title}
    </div>
  );

  const dayCell = (d: Date) => {
    const iso = toLocalISODate(d);
    const items = byDate[iso] ?? [];
    const isToday = iso === todayIso;
    const isSelected = iso === selected;
    const outside = view === 'month' && d.getMonth() !== anchor.getMonth();
    const shown = view === 'month' ? items.slice(0, 3) : items;
    return (
      <button
        key={iso}
        type="button"
        onClick={() => setSelected(iso)}
        aria-pressed={isSelected}
        aria-label={dayLabel(iso, { weekday: 'long', month: 'long', day: 'numeric' })}
        style={{
          textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
          minHeight: view === 'week' ? '150px' : '104px', padding: '8px', minWidth: 0, font: 'inherit',
          borderRadius: borderRadius.lg, background: colors.card, color: colors.textPrimary,
          border: `${isToday || isSelected ? 2 : 1}px solid ${isSelected ? colors.primary : isToday ? colors.warning : colors.border}`,
          opacity: outside ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: isToday ? 800 : 600, color: colors.textSecondary }}>
          {view === 'week' ? dayLabel(iso, { weekday: 'short', day: 'numeric' }) : d.getDate()}
        </span>
        {shown.map(chip)}
        {view === 'month' && items.length > 3 && (
          <span style={{ fontSize: '11px', color: colors.textSecondary }}>+{items.length - 3} more</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: colors.textPrimary }}>Meal Plan</h1>
        <div aria-live="polite" style={{ color: colors.textSecondary, fontSize: '15px', marginTop: '2px' }}>{title}</div>
      </div>
      {/* Controls sit BELOW the title, not beside it: the app's top bar is fixed to
          the top-right and covers anything that shares the title's row. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
        <div role="group" aria-label="Calendar view" style={{ display: 'flex', borderRadius: borderRadius.lg, overflow: 'hidden', border: `1.5px solid ${colors.borderDark}` }}>
          {(['week', 'month'] as PlannerView[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              style={{ minHeight: '40px', padding: '0 16px', border: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700,
                background: view === v ? colors.primary : colors.card, color: view === v ? colors.onPrimary : colors.textPrimary }}>
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
        <Button variant="secondary" icon={<ChevronLeft size={16} aria-hidden="true" />} onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}>Previous</Button>
        <Button variant="secondary" onClick={() => { setAnchor(new Date()); setSelected(todayIso); }}>Today</Button>
        <Button variant="secondary" iconRight={<ChevronRight size={16} aria-hidden="true" />} onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}>Next</Button>
        <Button icon={<CalendarPlus size={16} aria-hidden="true" />} onClick={() => setExporting(true)}>Export</Button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {nothingPlanned && (
            <EmptyState size="sm" title="Nothing planned yet"
              body="Add a meal to a day to start planning. Pick one of your recipes or just type a note." />
          )}

          {view === 'month' && (
            <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: colors.textSecondary }}>
              {weekDays(startOfWeek(anchor)).map((d) => <div key={d.getDay()}>{fmt(d, { weekday: 'short' })}</div>)}
            </div>
          )}

          <div style={{
            display: 'grid', gap: '6px',
            gridTemplateColumns: view === 'week' ? 'repeat(auto-fit, minmax(104px, 1fr))' : 'repeat(7, minmax(0, 1fr))',
          }}>
            {days.map(dayCell)}
          </div>

          <section aria-label={dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })}
            style={{ padding: spacing.md, borderRadius: borderRadius.xl, background: colors.card, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: colors.textPrimary }}>
              {dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            {MEAL_SLOTS.map((slot) => {
              const items = selectedEntries.filter((e) => e.slot === slot);
              return (
                <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textSecondary }}>{SLOT_LABEL[slot]}</div>
                  {items.length === 0 && <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Nothing planned</div>}
                  {items.map((e) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '8px 12px', borderRadius: borderRadius.lg, background: colors.accentBg }}>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ fontWeight: 600, color: colors.textPrimary }}>
                          {e.title}
                          {e.cooked_at && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: colors.textSecondary }}>✓ Cooked</span>}
                        </div>
                        {e.servings ? <div style={{ fontSize: '12px', color: colors.textSecondary }}>{e.servings} serving{e.servings === 1 ? '' : 's'}</div> : null}
                      </div>
                      {!e.cooked_at && (
                        <Button size="sm" variant="secondary" icon={<Check size={14} aria-hidden="true" />} onClick={() => void cookEntry(e)}>
                          <span aria-label={`Mark ${e.title} as cooked`}>Mark cooked</span>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => void removeEntry(e)}>
                        <span aria-label={`Remove ${e.title}`}>Remove</span>
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button size="sm" variant="ghost" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setAdding({ date: selected, slot })}>
                      <span aria-label={`Add ${SLOT_LABEL[slot]} on ${dayLabel(selected, { month: 'long', day: 'numeric' })}`}>Add</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </section>

          <div>
            <Button variant="secondary" disabled={busy || entries.length === 0} icon={<ShoppingCart size={16} aria-hidden="true" />} onClick={() => void addMissingToShopping()}>
              Add missing items to shopping list
            </Button>
          </div>
        </>
      )}

      <AddMealModal
        open={!!adding}
        date={adding?.date ?? selected}
        slot={adding?.slot ?? 'dinner'}
        onClose={() => setAdding(null)}
        onAdd={addEntry}
      />

      <ExportModal open={exporting} week={week} month={month} onClose={() => setExporting(false)} />
    </div>
  );
}
