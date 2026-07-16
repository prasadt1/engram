#!/usr/bin/env node
/**
 * Render architecture.html in cream theme (1920×1080 CSS, 2× DPI) →
 * docs/devpost-public/annotated-05-architecture-light.png AND
 * docs/media/devpost-inline-architecture.png (committed inline image).
 * Usage: node capture-architecture-light.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT = join(ROOT, 'docs/devpost-public');
const MEDIA = join(ROOT, 'docs/media');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
await page.goto('file://' + join(__dirname, 'architecture.html') + '?mode=context&theme=cream');
await page.waitForFunction(() => document.fonts.status === 'loaded');
await page.waitForTimeout(300);

await page.screenshot({ path: join(OUT, 'annotated-05-architecture-light.png') });

mkdirSync(MEDIA, { recursive: true });
copyFileSync(
  join(OUT, 'annotated-05-architecture-light.png'),
  join(MEDIA, 'devpost-inline-architecture.png'),
);

await browser.close();
console.log('wrote annotated-05-architecture-light.png');
console.log('copied → docs/media/devpost-inline-architecture.png');
