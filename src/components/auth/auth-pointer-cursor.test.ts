import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('enabled buttons use a hand cursor and disabled buttons keep disabled feedback', () => {
  const globalStyles = readFileSync(
    new URL('../../styles/globals.css', import.meta.url),
    'utf8'
  );

  assert.match(
    globalStyles,
    /button:not\(:disabled\):not\(\[aria-disabled=['"]true['"]\]\)\s*\{\s*cursor:\s*pointer;/
  );
  assert.match(
    globalStyles,
    /button:disabled,\s*button\[aria-disabled=['"]true['"]\]\s*\{\s*cursor:\s*not-allowed;/
  );
});
