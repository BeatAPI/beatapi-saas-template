import assert from 'node:assert/strict';
import test from 'node:test';

import { createLocalPreviewGenerationHistorySnapshot } from './local-preview-project';

test('history preview keeps three runs inside one visible generation node', () => {
  const snapshot = createLocalPreviewGenerationHistorySnapshot(
    new Date('2026-08-16T08:00:00.000Z')
  );

  assert.equal(
    snapshot.cards.filter((card) => card.kind === 'generation').length,
    1
  );
  assert.equal(snapshot.cards.filter((card) => card.kind === 'output').length, 3);
  assert.deepEqual(Object.keys(snapshot.frames), [
    'shape:local-preview-generation',
  ]);
});
