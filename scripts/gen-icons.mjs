// Generates the app icon (a suitcase) as PNGs at every size the PWA manifest
// needs, plus the SVG favicon. Uses `sharp` to rasterize hand-authored SVG —
// no browser needed, unlike the Playwright approach in sibling projects.
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const BG = '#1f2933'; // matches --bg
const CASE_FILL = '#c17a3d';
const CASE_LINE = '#8a5527';
const HANDLE = '#2a1a10';
const STRAP = '#8a5527';

// The suitcase, in a 100x100 viewBox, as a <g> so callers can transform it
// (the maskable variant needs to shrink it into the safe zone).
const suitcaseGroup = `<g>
  <rect x="41" y="24" width="18" height="16" rx="7" fill="none" stroke="${HANDLE}" stroke-width="5" />
  <rect x="20" y="36" width="60" height="46" rx="8" fill="${CASE_FILL}" stroke="${CASE_LINE}" stroke-width="2" />
  <rect x="46" y="36" width="8" height="46" fill="${STRAP}" />
  <rect x="20" y="55" width="60" height="6" fill="${STRAP}" />
  <rect x="35" y="48" width="8" height="7" rx="1.5" fill="${HANDLE}" />
  <rect x="57" y="48" width="8" height="7" rx="1.5" fill="${HANDLE}" />
</g>`;

// "any" purpose: rounded corners, suitcase at its natural scale/position.
// Used for favicon.svg, pwa-*.png, and apple-touch-icon.
function svgAny(rounded) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 18 : 0}" fill="${BG}" />
  ${suitcaseGroup}
</svg>
`;
}

// "maskable" purpose: OS icon masks clip anything outside a centered ~80%
// safe zone, so the suitcase is shrunk and recentered; background fills
// edge-to-edge with no rounding (the mask supplies the shape).
function svgMaskable() {
  const bboxCx = 50, bboxCy = 55; // approximate suitcase bounding-box center
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}" />
  <g transform="translate(50 50) scale(0.7) translate(${-bboxCx} ${-bboxCy})">
    ${suitcaseGroup}
  </g>
</svg>
`;
}

const svgFaviconAndAny = svgAny(true);
const svgApple = svgAny(false);
const svgMask = svgMaskable();

writeFileSync(join(publicDir, 'favicon.svg'), svgFaviconAndAny);

async function rasterize(svg, size, outFile) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, outFile));
}

await rasterize(svgFaviconAndAny, 192, 'pwa-192x192.png');
await rasterize(svgFaviconAndAny, 512, 'pwa-512x512.png');
await rasterize(svgMask, 512, 'pwa-512x512-maskable.png');
await rasterize(svgApple, 180, 'apple-touch-icon.png');

console.log(
  'Wrote favicon.svg, pwa-192x192.png, pwa-512x512.png, pwa-512x512-maskable.png, apple-touch-icon.png',
);
