import assert from 'node:assert/strict';
import test from 'node:test';

test('does not reuse a TCP-backed auth instance across Cloudflare Worker requests', async () => {
  const originalCloudflare = (globalThis as typeof globalThis & {
    Cloudflare?: unknown;
  }).Cloudflare;
  const originalEnv = {
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    VITE_APP_URL: process.env.VITE_APP_URL,
  };

  Object.defineProperty(globalThis, 'Cloudflare', {
    configurable: true,
    value: {},
  });
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_URL = 'postgres://example.invalid/database';
  process.env.AUTH_SECRET = 'test-auth-secret-with-at-least-32-characters';
  process.env.VITE_APP_URL = 'https://beatapi.net';

  try {
    const moduleUrl = new URL('./index.ts', import.meta.url);
    moduleUrl.searchParams.set('cloudflare-auth-lifetime', '1');
    const { getAuth } = (await import(moduleUrl.href)) as typeof import('./index');
    const configs = { email_auth_enabled: 'true' };

    const firstRequestAuth = getAuth(configs);
    const secondRequestAuth = getAuth(configs);

    assert.notStrictEqual(secondRequestAuth, firstRequestAuth);
  } finally {
    if (originalCloudflare === undefined) {
      Reflect.deleteProperty(globalThis, 'Cloudflare');
    } else {
      Object.defineProperty(globalThis, 'Cloudflare', {
        configurable: true,
        value: originalCloudflare,
      });
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
