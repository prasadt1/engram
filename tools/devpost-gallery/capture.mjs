#!/usr/bin/env node
/**
 * Playwright capture pipeline — read-only against production judge mode.
 * Saves full-page + cropped standalone PNGs to docs/devpost-screenshots/.
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONFIG = JSON.parse(readFileSync(join(__dirname, 'screens.json'), 'utf8'));
const RAW_DIR = join(ROOT, 'docs/devpost-screenshots/raw');
const OUT_DIR = join(ROOT, 'docs/devpost-screenshots');

function parseArgs(argv) {
  const args = { screen: null, base: CONFIG.baseUrl, skipMentor: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--screen' && argv[i + 1]) {
      args.screen = argv[++i];
    } else if (argv[i] === '--base' && argv[i + 1]) {
      args.base = argv[++i];
    } else if (argv[i] === '--skip-mentor') {
      args.skipMentor = true;
    }
  }
  return args;
}

function applyStorageKeys(keysOrPayload, opts = {}) {
  const keys = keysOrPayload?.keys ?? keysOrPayload;
  const skipWelcome = keysOrPayload?.skipWelcome === true || opts.skipWelcome === true;
  const skipBanner = keysOrPayload?.skipBanner === true || opts.skipBanner === true;
  for (const { storage, key, value } of Object.values(keys)) {
    if (skipWelcome && key === 'engram_judge_welcome_dismissed') continue;
    if (skipBanner && key === 'engram_judge_banner_dismissed') {
      const store = storage === 'sessionStorage' ? sessionStorage : localStorage;
      store.removeItem(key);
      continue;
    }
    const store = storage === 'sessionStorage' ? sessionStorage : localStorage;
    store.setItem(key, value);
  }
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
            setTimeout(resolve, 8000);
          }),
      ),
    );
  });
}

async function runInteractions(page, interactions = []) {
  for (const step of interactions) {
    if (step.type === 'click') {
      const loc = page.locator(step.selector);
      const target = step.index != null ? loc.nth(step.index) : loc.first();
      try {
        await target.scrollIntoViewIfNeeded({ timeout: step.timeoutMs ?? 15000 });
        await target.click({ timeout: step.timeoutMs ?? 20000 });
      } catch (err) {
        if (!step.optional) throw err;
      }
      await page.waitForTimeout(400);
    } else if (step.type === 'wait') {
      try {
        await page.locator(step.selector).first().waitFor({
          state: 'visible',
          timeout: step.timeoutMs ?? 30000,
        });
      } catch (err) {
        if (!step.optional) throw err;
      }
    } else if (step.type === 'type') {
      await page.locator(step.selector).first().fill(step.text, { timeout: 10000 });
    } else if (step.type === 'send_chat') {
      const input = page.locator('input[placeholder*="Ask about"]').first();
      await input.waitFor({ state: 'visible', timeout: 30000 });
      await input.fill(step.text);
      await page.getByRole('button', { name: 'Send message' }).click({ timeout: 10000 });
    } else if (step.type === 'scroll') {
      const loc = page.locator(step.selector).first();
      await loc.scrollIntoViewIfNeeded({ timeout: step.timeoutMs ?? 20000 });
      await page.waitForTimeout(step.waitMs ?? 400);
    } else if (step.type === 'wait_reply') {
      await page.waitForFunction(
        () => {
          const reply = document.querySelector('[aria-label="Engram mentor reply"]');
          const text = reply?.textContent?.trim() ?? '';
          return text.length > 40 && !text.includes('Reading your library');
        },
        { timeout: step.timeoutMs ?? 120000 },
      );
      await page.waitForTimeout(step.waitMs ?? 800);
    } else if (step.type === 'search_library') {
      await page.locator('input[aria-label="Search portfolio by meaning or keywords"]').fill(step.text);
      await page.getByRole('button', { name: 'Search' }).click({ timeout: 10000 });
      await page.waitForTimeout(step.waitMs ?? 1200);
    } else if (step.type === 'ask_mentor') {
      const chip = page.getByRole('button', { name: step.text, exact: true });
      if ((await chip.count()) > 0 && (await chip.first().isVisible())) {
        await chip.first().click();
      } else {
        const input = page.locator('input[placeholder*="Ask about"]').first();
        await input.waitFor({ state: 'visible', timeout: 30000 });
        await input.fill(step.text);
        await page.getByRole('button', { name: 'Send message' }).click({ timeout: 10000 });
      }
    }
  }
}

async function clickNav(page, label) {
  await page.locator('nav').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  const candidates = [
    page.locator('nav button', { hasText: label }),
    page.getByRole('tab', { name: label, exact: true }),
    page.getByRole('button', { name: label, exact: true }),
    page.locator(`button:has-text("${label}")`),
  ];
  for (const loc of candidates) {
    try {
      const el = loc.first();
      await el.waitFor({ state: 'visible', timeout: 15000 });
      await el.click({ timeout: 15000 });
      return true;
    } catch {
      /* try next strategy */
    }
  }
  return false;
}

async function navigateToScreen(page, screen, base) {
  const root = base.replace(/#.*$/, '');
  const storagePayload = {
    keys: CONFIG.storageKeys,
    skipBanner: screen.preserveJudgeBanner === true,
  };

  if (screen.navTab) {
    await page.goto(root, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(applyStorageKeys, storagePayload);
    const clicked = await clickNav(page, screen.navTab);
    if (!clicked) {
      throw new Error(`Could not navigate to tab: ${screen.navTab}`);
    }
    await page.waitForTimeout(1500);
  } else {
    const url = screen.hash ? `${root}${screen.hash}` : base;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(applyStorageKeys, storagePayload);
    if (screen.preserveJudgeBanner) {
      await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
      await page.evaluate(applyStorageKeys, storagePayload);
    }
  }
  await page.waitForTimeout(800);
  const skip = page.locator('button:has-text("Skip")');
  if ((await skip.count()) > 0 && (await skip.first().isVisible())) {
    await skip.first().click();
    await page.waitForTimeout(400);
  }
}

function cropBuffer(fullBuffer, crop, viewport, deviceScaleFactor) {
  if (!crop) return fullBuffer;
  const { scrollY = 0, height } = crop;
  const scale = deviceScaleFactor;
  const x = 0;
  const y = Math.round(scrollY * scale);
  const w = Math.round(viewport.width * scale);
  const h = Math.round(height * scale);
  return { fullBuffer, crop: { x, y, w, h } };
}

async function saveCroppedPng(page, destPath, screen) {
  const { viewport, deviceScaleFactor } = CONFIG;
  const dpr = deviceScaleFactor ?? 2;

  if (screen.capture === 'fullPage') {
    const full = await page.screenshot({ fullPage: true, type: 'png' });
    const rawPath = join(RAW_DIR, `${screen.id}-${screen.slug}-full.png`);
    await import('node:fs/promises').then((fs) => fs.writeFile(rawPath, full));
    if (screen.crop) {
      const { scrollY = 0, height } = screen.crop;
      const clip = {
        x: 0,
        y: scrollY,
        width: viewport.width,
        height: height,
      };
      await page.screenshot({ path: destPath, clip, type: 'png' });
    } else {
      await import('node:fs/promises').then((fs) => fs.writeFile(destPath, full));
    }
    return;
  }

  if (screen.focusSelector) {
    const el = page.locator(screen.focusSelector).first();
    await el.scrollIntoViewIfNeeded({ timeout: 30000 });
    await page.waitForTimeout(400);
    const box = await el.boundingBox();
    if (box) {
      const pad = 24;
      const clip = {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(CONFIG.viewport.width, box.width + pad * 2),
        height: Math.min(CONFIG.viewport.height, box.height + pad * 2),
      };
      await page.screenshot({ path: destPath, clip, type: 'png' });
      return;
    }
  }

  if (screen.crop?.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), screen.crop.scrollY);
    await page.waitForTimeout(300);
  }

  const clip =
    screen.crop && screen.crop.height
      ? {
          x: 0,
          y: screen.crop.scrollY ?? 0,
          width: viewport.width,
          height: screen.crop.height,
        }
      : undefined;

  await page.screenshot({ path: destPath, clip, type: 'png' });
  const rawPath = join(RAW_DIR, `${screen.id}-${screen.slug}-viewport.png`);
  await page.screenshot({ path: rawPath, fullPage: false, type: 'png' });
}

function renderArchitectureSvg(screen) {
  const svgPath = join(ROOT, screen.architectureSvg);
  const dest = join(OUT_DIR, `standalone-${screen.id}-${screen.slug}.png`);
  if (!existsSync(svgPath)) {
    throw new Error(`Missing architecture SVG: ${svgPath}`);
  }
  const result = spawnSync('rsvg-convert', ['-w', '4800', svgPath, '-o', dest], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`rsvg-convert failed: ${result.stderr}`);
  }
  console.log(`  wrote architecture asset → ${dest}`);
  return dest;
}

async function captureScreen(page, screen, base, opts) {
  console.log(`→ ${screen.id} · ${screen.slug}`);

  if (screen.source === 'architecture-svg') {
    return renderArchitectureSvg(screen);
  }

  if (screen.id === '03' && opts.skipMentor) {
    console.log('  skipped (mentor live call — use without --skip-mentor for final)');
    return null;
  }

  if (screen.viewport) {
    await page.setViewportSize(screen.viewport);
    await page.waitForTimeout(200);
  }

  await navigateToScreen(page, screen, base);

  if (screen.interactions?.length) {
    await runInteractions(page, screen.interactions);
  }

  if (screen.readySelector) {
    try {
      await page.locator(screen.readySelector).first().waitFor({
        state: 'visible',
        timeout: screen.id === '03' ? 120000 : 45000,
      });
    } catch (err) {
      console.warn(`  ready selector timeout: ${screen.readySelector}`);
    }
  }

  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await waitImagesComplete(page);
  await page.waitForTimeout(500);

  const dest = join(OUT_DIR, `standalone-${screen.id}-${screen.slug}.png`);
  await saveCroppedPng(page, dest, screen);
  console.log(`  wrote ${dest}`);
  return dest;
}

async function main() {
  const args = parseArgs(process.argv);
  let screens = CONFIG.screens;
  if (args.screen) {
    screens = screens.filter((s) => s.id === args.screen || s.slug === args.screen);
    if (!screens.length) {
      console.error(`Unknown screen: ${args.screen}`);
      process.exit(1);
    }
  }

  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const needsBrowser = screens.some((s) => s.source !== 'architecture-svg');
  if (!needsBrowser) {
    for (const screen of screens) {
      await captureScreen(null, screen, args.base, args);
    }
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    deviceScaleFactor: CONFIG.deviceScaleFactor ?? 2,
  });
  await context.addInitScript(applyStorageKeys, CONFIG.storageKeys);
  const page = await context.newPage();

  await page.goto(args.base, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(applyStorageKeys, CONFIG.storageKeys);
  await page.waitForTimeout(500);

  for (const screen of screens) {
    try {
      if (screen.preserveJudgeBanner) {
        const ctx = await browser.newContext({
          viewport: CONFIG.viewport,
          deviceScaleFactor: CONFIG.deviceScaleFactor ?? 2,
        });
        await ctx.addInitScript(applyStorageKeys, {
          keys: CONFIG.storageKeys,
          skipBanner: true,
        });
        const bannerPage = await ctx.newPage();
        await bannerPage.goto(args.base, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await bannerPage.evaluate(applyStorageKeys, {
          keys: CONFIG.storageKeys,
          skipBanner: true,
        });
        await captureScreen(bannerPage, screen, args.base, args);
        await ctx.close();
        continue;
      }
      await captureScreen(page, screen, args.base, args);
    } catch (err) {
      console.error(`  FAILED ${screen.id}: ${err.message}`);
      if (!screen.optional) throw err;
    }
  }

  await browser.close();
  console.log(`\nCaptures in: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
