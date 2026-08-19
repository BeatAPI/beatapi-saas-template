import assert from 'node:assert/strict';
import test from 'node:test';

import { BeatApiAdapter } from './beatapi-adapter';
import {
  BUILT_IN_GENERATION_PROVIDER_IDS,
  createAdapter,
  registerGenerationProvider,
} from './adapter-factory';
import {
  BaseAdapter,
  type GenerationEffectRecord,
  type GenerationResult,
} from './base-adapter';

const effectWithProvider = (provider: string) =>
  ({ provider } as GenerationEffectRecord);

class ProjectAdapter extends BaseAdapter {
  async createGeneration(): Promise<GenerationResult> {
    return { status: 'pending', output: { provider: 'project-api' } };
  }
}

test('BeatAPI is the only built-in generation adapter', () => {
  assert.deepEqual(BUILT_IN_GENERATION_PROVIDER_IDS, ['beatapi']);
  assert.ok(createAdapter(effectWithProvider('beatapi')) instanceof BeatApiAdapter);
});

test('a project can register and remove its own server-side provider adapter', () => {
  const unregister = registerGenerationProvider(
    'project-api',
    (effect) => new ProjectAdapter(effect)
  );

  assert.ok(
    createAdapter(effectWithProvider('project-api')) instanceof ProjectAdapter
  );

  unregister();
  assert.throws(
    () => createAdapter(effectWithProvider('project-api')),
    /Unsupported generation provider/
  );
});

test('project registrations cannot replace the built-in BeatAPI adapter', () => {
  assert.throws(
    () =>
      registerGenerationProvider(
        'beatapi',
        (effect) => new ProjectAdapter(effect)
      ),
    /cannot be replaced/
  );
});
