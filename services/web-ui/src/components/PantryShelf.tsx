/**
 * A pantry shelf, drawn.
 *
 * The signed-out surfaces had no imagery at all — just a card floating on a flat
 * gradient. Rather than reach for stock food photography (which dates badly and
 * costs a request), this is the product's own subject rendered as SVG: it
 * themes, scales, weighs nothing, and needs no network.
 *
 * *** It TILES, it does not stretch. *** The first version used a single
 * viewBox with `preserveAspectRatio="slice"`, which at 1440px cropped a 300-unit
 * tile so hard that the jars rendered as a row of blank rounded boxes. A
 * repeating background keeps every jar at its drawn proportions on any width.
 *
 * Decorative — `aria-hidden`, skipped by screen readers.
 */

interface PantryShelfProps {
  /** Height of the strip in px. The tile scales to fit it. */
  height?: number;
  isDark?: boolean;
  style?: React.CSSProperties;
}

const TILE_W = 300;
const TILE_H = 78;
const SHELF_Y = 62;

// Hand-placed rather than generated, so the silhouette has rhythm
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

function tileSvg(isDark: boolean): string {
  const body = isDark
    ? ['#5c4527', '#6b5130', '#4e3a20']
    : ['#e8c79b', '#edd2ac', '#dfb987'];
  const edge = isDark ? '#7a5c33' : '#cda370';
  const lid = isDark ? '#8a683a' : '#c08e52';
  const board = isDark ? '#6b5130' : '#d8b98c';
  const shine = isDark ? 0.08 : 0.35;

  const jars = JARS.map((j) => {
    const top = SHELF_Y - j.h;
    return (
      `<rect x="${j.x + j.w * 0.18}" y="${top - 5}" width="${j.w * 0.64}" height="5" rx="1.5" fill="${lid}"/>` +
      `<rect x="${j.x}" y="${top}" width="${j.w}" height="${j.h}" rx="4" fill="${body[j.tone]}" stroke="${edge}" stroke-width="1.2"/>` +
      `<rect x="${j.x + 3}" y="${top + 5}" width="2" height="${Math.max(j.h - 14, 4)}" rx="1" fill="#ffffff" opacity="${shine}"/>`
    );
  }).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_W} ${TILE_H}" width="${TILE_W}" height="${TILE_H}">` +
    jars +
    `<rect x="0" y="${SHELF_Y}" width="${TILE_W}" height="5" rx="2" fill="${board}"/>` +
    `</svg>`;

  // encodeURIComponent rather than base64: smaller, and readable in devtools.
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function PantryShelf({ height = 96, isDark = false, style }: PantryShelfProps) {
  const tileW = Math.round((TILE_W / TILE_H) * height);
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width: '100%',
        backgroundImage: tileSvg(isDark),
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left bottom',
        backgroundSize: `${tileW}px ${height}px`,
        ...style,
      }}
    />
  );
}

export default PantryShelf;
