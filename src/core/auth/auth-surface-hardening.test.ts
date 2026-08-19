import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);

test('does not expose the HttpOnly session token through an API route', async () => {
  await assert.rejects(
    access(new URL('src/routes/api/auth/token.ts', repoRoot)),
    (error: NodeJS.ErrnoException) => error.code === 'ENOENT'
  );
});

test('does not build redirects through the removed auth-callback flow', async () => {
  const files = [
    'src/routes/(auth)/sign-in.tsx',
    'src/routes/(auth)/sign-up.tsx',
    'src/routes/api/payment/checkout.ts',
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, repoRoot), 'utf8'))
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /auth-callback/);
    assert.doesNotMatch(source, /redirectParam/);
  }
});
