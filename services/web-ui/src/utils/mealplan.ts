import type { MealPlanEntry, MealSlot } from '../types';
import { toLocalISODate } from './dateUtils';

export type PlannerView = 'week' | 'month';

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Weeks start on Monday, matching the planner mockups. */
export function startOfWeek(d: Date): Date {
  const offset = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  return addDays(d, -offset);
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole weeks covering the month: from the Monday on/before the 1st to the Sunday on/after the last. */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The inclusive ISO range the server is asked for. A month asks for the whole grid so spill-over days show too. */
export function rangeFor(view: PlannerView, anchor: Date): { start: string; end: string } {
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  return { start: toLocalISODate(days[0]), end: toLocalISODate(days[days.length - 1]) };
}

export function shiftAnchor(view: PlannerView, anchor: Date, direction: 1 | -1): Date {
  if (view === 'week') return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const SLOT_RANK: Record<string, number> = Object.fromEntries(MEAL_SLOTS.map((s, i) => [s, i]));

/** Entries by day, each day ordered breakfast -> snack. */
export function groupByDate(entries: MealPlanEntry[]): Record<string, MealPlanEntry[]> {
  const out: Record<string, MealPlanEntry[]> = {};
  for (const e of entries) (out[e.plan_date] ??= []).push(e);
  for (const day of Object.values(out)) day.sort((a, b) => (SLOT_RANK[a.slot] ?? 9) - (SLOT_RANK[b.slot] ?? 9));
  return out;
}
