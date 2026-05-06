import { useEffect, useState, useRef } from 'react';
import { tourSteps } from './tourSteps';
import TourTooltip from './TourTooltip';

const PAD = 8;

interface Props {
  step: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
  onEnd: () => void;
}

export default function TourOverlay({ step, total, onNext, onPrev, onGoTo, onEnd }: Props) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setRect(null);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function measure() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const s = tourSteps[step];
      const el = document.getElementById(s.zoneId);
      if (!el) { onNext(); return; }
      const r = el.getBoundingClientRect();
      setRect({
        top:    r.top    + window.scrollY,
        left:   r.left   + window.scrollX,
        width:  r.width,
        height: r.height,
      });
    });
  }

  if (!rect) return null;

  const spotTop    = rect.top    - PAD;
  const spotLeft   = rect.left   - PAD;
  const spotWidth  = rect.width  + PAD * 2;
  const spotHeight = rect.height + PAD * 2;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>
      {/* 4-panel dim overlay — clicking any panel closes the tour */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, spotTop), background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }} onClick={onEnd} />
      <div style={{ position: 'fixed', top: spotTop + spotHeight, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }} onClick={onEnd} />
      <div style={{ position: 'fixed', top: spotTop, left: 0, width: Math.max(0, spotLeft), height: spotHeight, background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }} onClick={onEnd} />
      <div style={{ position: 'fixed', top: spotTop, left: spotLeft + spotWidth, right: 0, height: spotHeight, background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }} onClick={onEnd} />

      {/* Spotlight border ring */}
      <div style={{
        position: 'fixed',
        top: spotTop, left: spotLeft,
        width: spotWidth, height: spotHeight,
        borderRadius: '14px',
        border: '2px solid rgba(255,255,255,0.22)',
        boxShadow: '0 0 0 1px rgba(217,119,6,0.4)',
        pointerEvents: 'none',
        transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
      }} />

      <TourTooltip
        step={step}
        total={total}
        spotRect={{ top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight }}
        onNext={onNext}
        onPrev={onPrev}
        onGoTo={onGoTo}
        onEnd={onEnd}
      />
    </div>
  );
}
