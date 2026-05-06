import { useState, useEffect } from 'react';
import { tourSteps } from './tourSteps';

const TOUR_KEY = 'pantrypal_tour_done';

export function useTour(authenticated: boolean) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!authenticated) return;
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const t = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(t);
    }
  }, [authenticated]);

  function next() {
    if (step < tourSteps.length - 1) setStep(s => s + 1);
    else end();
  }

  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  function goTo(i: number) {
    setStep(i);
  }

  function end() {
    localStorage.setItem(TOUR_KEY, 'true');
    setActive(false);
    setStep(0);
  }

  function replay() {
    localStorage.removeItem(TOUR_KEY);
    setStep(0);
    setActive(true);
  }

  return { active, step, next, prev, goTo, end, replay };
}
