import { useEffect, useState } from 'react';

/**
 * Matches the `max-width: 1024px` breakpoint App.css uses for the sidebar.
 *
 * *** THIS NUMBER MUST EQUAL THE ONE IN App.css. *** 1024 is where `.sidebar`
 * leaves the flex row and becomes `position: fixed`. Picking 768 here (the
 * other breakpoint in that file) leaves 769-1024px with a fixed sidebar
 * covering the page and no toggle rendered to close it.
 *
 * Kept in JS as well as CSS because the sidebar's open/closed state is a
 * React concern: the CSS can slide the panel off-screen, but only the
 * component can decide not to render it, and leaving a 30-stop menu in the
 * tab order while it sits at `left: -280px` is worse than either.
 */
export const MOBILE_BREAKPOINT = 1024;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

export default useIsMobile;
