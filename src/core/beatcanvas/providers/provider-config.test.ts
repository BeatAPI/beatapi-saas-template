import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BEATAPI_BASE_URL,
  getBeatCanvasProviderPublicConfig,
  getBeatCanvasProviderServerConfig,
  resolveBeatCanvasProviderId,
} from './provider-config';

test('BeatAPI is the default BeatCanvas generation provider', () => {
  assert.equal(resolveBeatCanvasProviderId(undefined), 'beatapi');
  assert.deepEqual(getBeatCanvasProviderPublicConfig(undefined), {
    id: 'beatapi',
    label: 'BeatAPI',
    isDefault: true,
    supports: ['image', 'video'],
  });
});

test('unknown provider values cannot select a second generation upstream', () => {
  assert.deepEqual(
    getBeatCanvasProviderServerConfig({
      providerId: 'custom',
      baseUrl: 'https://example.com/',
      apiKey: 'secret',
    }),
    {
      id: 'beatapi',
      label: 'BeatAPI',
      isDefault: true,
      supports: ['image', 'video'],
      baseUrl: 'https://example.com',
      apiKey: 'secret',
    }
  );
});

test('default server config points to the production BeatAPI endpoint', () => {
  assert.equal(
    getBeatCanvasProviderServerConfig().baseUrl,
    DEFAULT_BEATAPI_BASE_URL
  );
});
