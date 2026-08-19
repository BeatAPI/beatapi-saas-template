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

test('custom provider config keeps the same image and video contract', () => {
  assert.deepEqual(
    getBeatCanvasProviderServerConfig({
      providerId: 'custom',
      baseUrl: 'https://example.com/',
      apiKey: 'secret',
    }),
    {
      id: 'custom',
      label: 'Custom API',
      isDefault: false,
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
