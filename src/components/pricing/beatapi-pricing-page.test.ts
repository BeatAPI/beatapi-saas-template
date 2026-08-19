import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(
  new URL('../../routes/pricing.tsx', import.meta.url),
  'utf8'
);
const pageSource = readFileSync(
  new URL('./beatapi-pricing-page.tsx', import.meta.url),
  'utf8'
);
const shellSource = readFileSync(
  new URL('../marketing/beatapi-product-shell.tsx', import.meta.url),
  'utf8'
);
const gridSource = readFileSync(
  new URL('./pricing-credit-pack-grid.tsx', import.meta.url),
  'utf8'
);

test('pricing is a real linkable page instead of a compatibility redirect', () => {
  assert.match(routeSource, /BeatApiPricingPage/);
  assert.doesNotMatch(routeSource, /redirect/);
});

test('pricing rides on the shared product shell so every public page shares one header', () => {
  assert.match(pageSource, /BeatApiProductShell/);
  assert.match(pageSource, /active="pricing"/);
  assert.match(pageSource, /PricingCreditPackGrid variant="home"/);
  // The floating capsule header lives in the shell, not in per-page markup.
  assert.match(shellSource, /bg-\[#131416\]\/90/);
  assert.match(shellSource, /rounded-full/);
  assert.doesNotMatch(pageSource, /<header/);
});

test('pricing uses the original BeatAPI structure and shared black visual system', () => {
  assert.match(gridSource, /Simple pricing that scales with you/);
  assert.match(gridSource, /data-beatapi-pricing-carousel/);
  assert.match(gridSource, /rounded-\[38px\]/);
  assert.match(gridSource, /h-\[260px\]/);
  assert.match(gridSource, /bg-\[#141517\]/);
  assert.match(gridSource, /bg-\[#0c0d0f\]/);
});
