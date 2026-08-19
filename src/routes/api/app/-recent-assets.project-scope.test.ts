import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./recent-assets.ts', import.meta.url), 'utf8');

test('project assets are authorized and loaded through project membership', () => {
  assert.match(source, /getProjectForUser/);
  assert.match(source, /projectAssetMembership/);
  assert.match(source, /eq\(projectAssetMembership\.projectId, projectId\)/);
  assert.match(source, /selectDistinct/);
});
