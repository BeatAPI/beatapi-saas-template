import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./beatapi-product-shell.tsx', import.meta.url),
  'utf8'
);

test('signed-out account button swaps its icon and label positions on hover', () => {
  assert.match(source, /<ArrowRight/);
  assert.doesNotMatch(source, /ArrowUpRight/);
  assert.match(source, /duration-700/);
  assert.match(source, /sm:group-hover:left-\[calc\(100%-2\.5rem\)\]/);
  assert.match(source, /sm:group-hover:left-5/);
  assert.match(source, /sm:group-focus-visible:left-5/);
  assert.match(source, /motion-reduce:transition-none/);
});
