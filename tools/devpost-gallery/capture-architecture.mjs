#!/usr/bin/env node
/**
 * Render architecture.html (1920×1080 CSS) at deviceScaleFactor 2 →
 * docs/devpost-public/annotated-05-architecture.png (3840×2160) and a
 * header/footer-free crop as standalone-05-architecture.png.
 * Usage: node capture-architecture.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT = join(ROOT, 'docs/devpost-public');
const MEDIA = join(ROOT, 'docs/media');

// channel: 'chrome' uses the installed Google Chrome — no Playwright browser
// download needed (the ms-playwright cache is empty on this machine).
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
await page.goto('file://' + join(__dirname, 'architecture.html') + '?mode=context&theme=dark');
await page.waitForFunction(() => document.fonts.status === 'loaded');
await page.waitForTimeout(300);

await page.screenshot({ path: join(OUT, 'annotated-05-architecture.png') });

// Standalone: the diagram only (no branded header/footer), for gallery use.
await page.locator('#diagram').screenshot({ path: join(OUT, 'standalone-05-architecture.png') });

mkdirSync(MEDIA, { recursive: true });
copyFileSync(
  join(OUT, 'standalone-05-architecture.png'),
  join(MEDIA, 'devpost-gallery-architecture.png'),
);

await browser.close();
console.log('wrote annotated-05-architecture.png + standalone-05-architecture.png');
console.log('copied → docs/media/devpost-gallery-architecture.png');
