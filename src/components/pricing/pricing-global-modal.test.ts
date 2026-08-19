import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('root owns one global pricing modal provider', () => {
  const rootSource = read('../../routes/__root.tsx');

  assert.match(rootSource, /PricingModalProvider/);
  assert.match(rootSource, /<PricingModalProvider>/);
});

test('pricing triggers use the global modal instead of local modal state', () => {
  const accountSource = read('../account/account-center-dialog.tsx');
  const siteHeaderSource = read('../site-header.tsx');

  assert.match(accountSource, /usePricingModal/);
  assert.doesNotMatch(accountSource, /setPricingModal/);
  assert.match(siteHeaderSource, /usePricingModal/);
  assert.match(siteHeaderSource, /link\.href === ['"]\/pricing['"]/);
});

test('canvas header no longer exposes upgrade pricing inside the workspace', () => {
  const productShellSource = read('../app/product-page-shell.tsx');

  assert.doesNotMatch(productShellSource, /WorkspaceApiConfigDialog/);
  assert.doesNotMatch(productShellSource, /usePricingModal/);
  assert.doesNotMatch(productShellSource, /credits\.upgrade/);
});

test('global pricing modal preserves the current page while syncing pricing state', () => {
  const providerUrl = new URL('./pricing-modal-provider.tsx', import.meta.url);
  assert.equal(existsSync(providerUrl), true, 'global pricing provider is missing');
  const providerSource = readFileSync(providerUrl, 'utf8');

  assert.match(providerSource, /window\.location\.href/);
  assert.match(providerSource, /searchParams\.set\('pricing', '1'\)/);
  assert.match(providerSource, /searchParams\.delete\('pricing'\)/);
  assert.match(providerSource, /replaceState/);
  assert.match(providerSource, /import\('\.\.\/home\/pricing-modal-impl'\)/);
});

test('pricing modal exposes dialog semantics and restores focus', () => {
  const modalSource = read('../home/pricing-modal-impl.tsx');

  assert.match(modalSource, /role="dialog"/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalSource, /previousActiveElementRef/);
});
