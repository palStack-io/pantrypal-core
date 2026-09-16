/**
 * A pantry shelf, drawn.
 *
 * The signed-out surfaces had no imagery at all — just a card floating on a flat
 * gradient. Rather than reach for stock food photography (which dates badly and
 * costs a request), this is the product's own subject rendered as inline SVG:
 * it themes, scales, weighs nothing, and needs no network.
 *
 * Deliberately decorative — `aria-hidden`, so it is skipped by screen readers.
 */

interface PantryShelfProps {
  /** Height in px. Width always fills the parent. */
  height?: number;
  isDark?: boolean;
  style?: React.CSSProperties;
}

// Jar geometry, hand-placed rather than generated so the silhouette has rhythm
// (tall/short/tall) instead of the even spacing a loop produces.
const JARS: { x: number; w: number; h: number; tone: number }[] = [
  { x: 4, w: 30, h: 44, tone: 0 },
  { x: 40, w: 22, h: 30, tone: 1 },
  { x: 68, w: 34, h: 54, tone: 2 },
  { x: 108, w: 26, h: 36, tone: 0 },
  { x: 140, w: 30, h: 48, tone: 1 },
  { x: 176, w: 21, h: 28, tone: 2 },
  { x: 203, w: 32, h: 50, tone: 0 },
  { x: 241, w: 25, h: 38, tone: 1 },
  { x: 272, w: 22, h: 32, tone: 2 },
];

const VB_W = 300;
const VB_H = 78;
const SHELF_Y = 62;

export function PantryShelf({ height = 96, isDark = false, style }: PantryShelfProps) {
  const body = isDark
    ? ['#5c4527', '#6b5130', '#4e3a20']
    : ['#e8c79b', '#edd2ac', '#dfb987'];
  const edge = isDark ? '#7a5c33' : '#cda370';
  const lid = isDark ? '#8a683a' : '#c08e52';
  const board = isDark ? '#6b5130' : '#d8b98c';

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', ...style }}
    >
      {JARS.map((j, i) => {
        const top = SHELF_Y - j.h;
        return (
          <g key={i}>
            {/* lid */}
            <rect
              x={j.x + j.w * 0.18}
              y={top - 5}
              width={j.w * 0.64}
              height={5}
              rx={1.5}
              fill={lid}
            />
            {/* body */}
            <rect
              x={j.x}
              y={top}
              width={j.w}
              height={j.h}
              rx={4}
              fill={body[j.tone]}
              stroke={edge}
              strokeWidth={1.2}
            />
            {/* a single highlight down the left of the glass */}
            <rect
              x={j.x + 3}
              y={top + 5}
              width={2}
              height={Math.max(j.h - 14, 4)}
              rx={1}
              fill="#ffffff"
              opacity={isDark ? 0.08 : 0.35}
            />
          </g>
        );
      })}
      {/* the shelf board the jars stand on */}
      <rect x={0} y={SHELF_Y} width={VB_W} height={5} rx={2} fill={board} />
    </svg>
  );
}

export default PantryShelf;
