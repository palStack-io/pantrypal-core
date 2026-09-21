import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getStats } from '../api';
import { onInventoryChanged } from '../utils/inventoryEvents';
import type { InventoryStats } from '../types';

const EMPTY: InventoryStats = {
  total_items: 0, total_quantity: 0,
  expiring_soon: 0, expired: 0, fresh: 0, no_date: 0,
  locations_count: 0, categories_count: 0, manually_added_count: 0,
  locations: [], categories: [],
};

/**
 * Whole-inventory counts, from the server.
 *
 * The sidebar used to build these from `useItems()`, which paginates at 50 --
 * so a 96-item pantry read "50 items" and listed only the locations that
 * happened to fall on page one. It also meant a second full item fetch on
 * every page load purely to count things.
 *
 * Refetches when anything reports a mutation, so the counts stay honest
 * without `useItems` having to become shared state.
 */
export function useInventoryStats() {
  const [stats, setStats] = useState<InventoryStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getStats(controller.signal);
      setStats(data);
    } catch (err) {
      // An abort is this hook superseding itself, not a failure. Anything
      // else leaves the previous numbers on screen rather than flashing
      // zeroes, which would read as "your pantry is empty".
      if (!axios.isCancel(err)) {
        // eslint-disable-next-line no-console
        console.warn('[useInventoryStats] could not load stats', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = onInventoryChanged(load);
    return () => { off(); abortRef.current?.abort(); };
  }, [load]);

  return { stats, loading, refresh: load };
}

export default useInventoryStats;
