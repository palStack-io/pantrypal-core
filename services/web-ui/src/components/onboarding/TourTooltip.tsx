import React from 'react';
import { tourSteps } from './tourSteps';
import { useTheme } from '../../context/ThemeContext';
import { getColors } from '../../colors';

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 200;
const GAP = 14;

interface Props {
  step: number;
  total: number;
  spotRect: { top: number; left: number; width: number; height: number };
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
  onEnd: () => void;
}

export default function TourTooltip({ step, total, spotRect, onNext, onPrev, onGoTo, onEnd }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const s = tourSteps[step];
  const { top: sTop, left: sLeft, width: sW, height: sH } = spotRect;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number, left: number;
  switch (s.place) {
    case 'below':
      top  = sTop + sH + GAP;
      left = sLeft + sW / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'above':
      top  = sTop - TOOLTIP_HEIGHT - GAP;
      left = sLeft + sW / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'left':
      top  = sTop + sH / 2 - TOOLTIP_HEIGHT / 2;
      left = sLeft - TOOLTIP_WIDTH - GAP;
      break;
    case 'right':
    default:
      top  = sTop + sH / 2 - TOOLTIP_HEIGHT / 2;
      left = sLeft + sW + GAP;
      break;
  }

  left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12));
  top  = Math.max(12, Math.min(top,  vh - TOOLTIP_HEIGHT - 12));

  const isFirst = step === 0;
  const isLast  = step === total - 1;

  const arrowBase: React.CSSProperties = {
    position: 'absolute',
    width: '10px',
    height: '10px',
    background: colors.card,
    transform: 'rotate(45deg)',
  };

  const arrowStyles: Record<string, React.CSSProperties> = {
    top:    { top: '-6px',    left: 'calc(50% - 5px)', borderTop: `1px solid ${colors.border}`,    borderLeft: `1px solid ${colors.border}` },
    bottom: { bottom: '-6px', left: 'calc(50% - 5px)', borderBottom: `1px solid ${colors.border}`, borderRight: `1px solid ${colors.border}` },
    left:   { left: '-6px',   top: 'calc(50% - 5px)',  borderBottom: `1px solid ${colors.border}`, borderLeft: `1px solid ${colors.border}` },
    right:  { right: '-6px',  top: 'calc(50% - 5px)',  borderTop: `1px solid ${colors.border}`,    borderRight: `1px solid ${colors.border}` },
  };

  return (
    <div style={{
      position: 'fixed',
      top,
      left,
      width: TOOLTIP_WIDTH,
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '18px',
      padding: '20px 22px',
      pointerEvents: 'auto',
      zIndex: 1001,
      transition: 'top 0.3s cubic-bezier(.4,0,.2,1), left 0.3s cubic-bezier(.4,0,.2,1)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
    }}>
      {/* Arrow */}
      <div style={{ ...arrowBase, ...arrowStyles[s.arrow] }} />

      {/* Step label */}
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: colors.primary, marginBottom: '6px' }}>
        {step + 1} / {total} — {s.label}
      </div>

      {/* Title */}
      <div style={{ fontSize: '16px', fontWeight: 800, color: colors.textPrimary, marginBottom: '7px', lineHeight: 1.25 }}>
        {s.title}
      </div>

      {/* Body */}
      <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.65, marginBottom: '16px' }}>
        {s.body}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Pip dots */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              onClick={() => onGoTo(i)}
              style={{
                width: i === step ? '14px' : '5px',
                height: '5px',
                borderRadius: '50px',
                background: i === step ? colors.primary : colors.border,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={onEnd} style={{ padding: '6px 11px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', fontSize: '11px', fontWeight: 700, color: colors.textSecondary, cursor: 'pointer' }}>
            Skip
          </button>
          {!isFirst && (
            <button onClick={onPrev} style={{ padding: '6px 11px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', fontSize: '11px', fontWeight: 700, color: colors.textSecondary, cursor: 'pointer' }}>
              ←
            </button>
          )}
          <button onClick={onNext} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: colors.primary, color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
            {isLast ? "Let's go! 🎉" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
