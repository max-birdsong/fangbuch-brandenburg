// Renders the PWA PNG icons from public/icons/icon.svg. Run: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
// Maskable: full-bleed background with the artwork inside the safe zone.
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0E4C5C' } })
  .composite([{ input: await sharp(svg).resize(400, 400).png().toBuffer(), top: 56, left: 56 }])
  .png()
  .toFile(out('icon-maskable-512.png'));
console.log('Icons written to public/icons/');
