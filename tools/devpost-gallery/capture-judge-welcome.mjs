#!/usr/bin/env node
/**
 * Capture a tight Home hero crop for JudgeWelcome landing (frontend/public/).
 * Waits for hero image bytes before screenshot; outputs WebP ≤300 KB when cwebp exists.
 */
import { readFileSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONFIG = JSON.parse(readFileSync(join(__dirname, 'screens.json'), 'utf8'));
const PUBLIC_DIR = join(ROOT, 'frontend/public');
const OUT_WEBP = join(PUBLIC_DIR, 'judge-welcome-home.webp');
const OUT_JPG = join(PUBLIC_DIR, 'judge-welcome-home.jpg');
const TMP_PNG = join(PUBLIC_DIR, '.judge-welcome-capture.png');

function applyStorageKeys(keys) {
  for (const { storage, key, value } of Object.values(keys)) {
    const store = storage === 'sessionStorage' ? sessionStorage : localStorage;
    store.setItem(key, value);
  }
  sessionStorage.setItem('engram_judge_welcome_dismissed', 'true');
}

async function waitImagesComplete(page) {
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
            setTimeout(resolve, 12000);
          }),
      ),
    );
  });
}

async function main() {
  const base = process.argv[2] ?? CONFIG.baseUrl ?? 'https://engram.prasadtilloo.com/?judge=1';
  const root = base.replace(/#.*$/, '');

  mkdirSync(PUBLIC_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(applyStorageKeys, CONFIG.storageKeys);
  const page = await ctx.newPage();

  await page.goto(`${root}#home`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('[data-testid="home-mentor-hero"]').first().waitFor({
    state: 'visible',
    timeout: 60000,
  });
  await page.getByText('Your mentor read', { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });

  await page.waitForFunction(
    () => {
      const img = document.querySelector('[data-testid="home-mentor-hero"] img');
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 80;
    },
    { timeout: 60000 },
  );

  await waitImagesComplete(page);
  await page.waitForTimeout(800);

  const hero = page.locator('[data-testid="home-mentor-hero"]').first();
  await hero.scrollIntoViewIfNeeded();
  await hero.screenshot({ path: TMP_PNG, type: 'png' });

  await browser.close();

  let outPath = OUT_WEBP;
  const cwebp = spawnSync('cwebp', ['-q', '82', TMP_PNG, '-o', OUT_WEBP], { encoding: 'utf8' });
  if (cwebp.status !== 0) {
    console.warn('cwebp unavailable — falling back to JPEG');
    const sips = spawnSync(
      'sips',
      ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', TMP_PNG, '--out', OUT_JPG],
      { encoding: 'utf8' },
    );
    if (sips.status !== 0) {
      throw new Error(`Could not convert capture: ${cwebp.stderr || sips.stderr}`);
    }
    outPath = OUT_JPG;
  }

  try {
    unlinkSync(TMP_PNG);
  } catch {
    /* ignore */
  }

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(`Wrote ${outPath} (${sizeKb} KB)`);
  if (sizeKb > 300) {
    console.warn('Warning: file exceeds 300 KB target — re-run with lower quality if needed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
