#!/usr/bin/env node
/**
 * Capture the Coach Assist roster (Jordan / Alex / Sam) from the LIVE judge
 * demo at deviceScaleFactor 2 → docs/media/devpost-inline-coach-assist.png.
 * Same viewport/scale conventions as the other devpost-inline captures.
 * Usage: node capture-coach-assist.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MEDIA = join(ROOT, 'docs/media');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
await page.goto('https://engram.prasadtilloo.com/?judge=1', { waitUntil: 'networkidle' });

// Into Coach Assist via the sidebar.
await page.locator('aside :text("Coach Assist"), nav :text("Coach Assist")').first().click();
await page.getByText('Loading learners').waitFor({ state: 'detached', timeout: 45000 });
await page.waitForTimeout(600); // let card transitions settle

// Dismiss the judge banner so the roster is the subject of the frame.
const dismiss = page.locator('button[aria-label*="ismiss"], button:has-text("✕"), button:has-text("×")').first();
if (await dismiss.count()) await dismiss.click().catch(() => {});
await page.waitForTimeout(300);

mkdirSync(MEDIA, { recursive: true });
await page.screenshot({ path: join(MEDIA, 'devpost-inline-coach-assist.png') });
console.log('wrote docs/media/devpost-inline-coach-assist.png');
await browser.close();
