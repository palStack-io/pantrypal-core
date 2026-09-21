import { useEffect, useId, useRef } from 'react';

/**
 * The four things every modal owes a keyboard or screen-reader user.
 *
 * *** THE APP HAS TEN OVERLAY IMPLEMENTATIONS AND ONE OF THEM IS
 * ACCESSIBLE. *** `components/Modal.tsx` gets it right and almost nothing
 * uses it; the rest are hand-rolled `position: fixed` divs with a backdrop
 * click and a close button, and nothing else. Opening one leaves
 * `document.activeElement` on `<body>`, Escape does nothing, and the page
 * behind keeps scrolling.
 *
 * Ported from pantrypal_premium, where the same defect was measured on
 * 2026-09-20; core carries the same overlays from the same shared ancestry.
 *
 * Migrating all of them onto `Modal.tsx` would mean restructuring eight
 * layouts, because that component owns its header and footer markup. This is
 * the behaviour half on its own, so it can be applied without touching a
 * single line of anyone's layout:
 *
 *   1. Escape closes.
 *   2. Focus moves into the panel, and returns to whatever opened it.
 *   3. The page behind stops scrolling.
 *   4. role=dialog + aria-modal + a UNIQUE label id.
 *
 * On (4): `Modal.tsx` hardcodes `aria-labelledby="modal-title"`, so two open
 * dialogs produce a duplicate id and an ambiguous name. `useId()` avoids that.
 *
 * Usage:
 *
 *   const modal = useModalBehavior(onClose);
 *   <div style={backdrop} onClick={onClose}>
 *     <div {...modal.panelProps} style={panel} onClick={stop}>
 *       <h2 id={modal.titleId}>…</h2>
 *
 * Deliberately NOT a focus trap. A real one needs to handle shadow roots,
 * iframes and portals to be correct, and a half-built trap that leaks is worse
 * than none: it convinces you the problem is solved. Escape plus a focus move
 * covers the case people actually hit.
 */
export interface ModalBehavior {
  titleId: string;
  panelProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    role: 'dialog';
    'aria-modal': true;
    'aria-labelledby': string;
    tabIndex: -1;
  };
}

export function useModalBehavior(onClose: () => void, isOpen = true): ModalBehavior {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${useId()}`;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Prefer the first real control; fall back to the panel itself. Focusing
    // the panel is what makes a screen reader announce the dialog at all.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel)?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      // Only restore if focus is still somewhere inside the closing panel --
      // otherwise we would yank it back from wherever the user has since gone.
      if (!panel || panel.contains(document.activeElement)) previous?.focus?.();
    };
  }, [isOpen]);

  return {
    titleId,
    panelProps: {
      ref: panelRef,
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': titleId,
      tabIndex: -1,
    },
  };
}

export default useModalBehavior;
