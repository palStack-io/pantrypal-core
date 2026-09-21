/**
 * A one-line pub/sub so anything showing a derived count can hear about a
 * mutation.
 *
 * `useItems` is not shared state -- every caller gets its own instance with
 * its own fetch. So the sidebar's counts were computed from a SECOND,
 * independent copy of the item list, which meant adding or deleting an item
 * on the inventory page left the sidebar showing the old numbers until
 * something happened to remount it. Lifting `useItems` into a context would
 * fix that too, but it touches every consumer; this is the smallest thing
 * that makes the counts honest.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Call after any create/update/delete that could move a count. */
export function emitInventoryChanged(): void {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // A broken subscriber must not stop the others from being told.
    }
  });
}

/** Subscribe; returns the unsubscribe, shaped for a useEffect cleanup. */
export function onInventoryChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
