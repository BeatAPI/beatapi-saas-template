import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shellSource = readFileSync(
  new URL('./product-page-shell.tsx', import.meta.url),
  'utf8'
);
test('workspace header keeps mode switching and shared assets', () => {
  assert.doesNotMatch(shellSource, /WorkspaceApiConfigDialog/);
  assert.match(shellSource, /ProjectAssetsDialog/);
  assert.match(shellSource, />Studio<\/span>/);
  assert.match(shellSource, />Canvas<\/span>/);
  assert.match(shellSource, /\{ workspaceMode \}/);
  assert.doesNotMatch(shellSource, /usePricingModal/);
  assert.doesNotMatch(shellSource, /credits\.upgrade/);
  assert.doesNotMatch(shellSource, /getUserInitial/);
});
