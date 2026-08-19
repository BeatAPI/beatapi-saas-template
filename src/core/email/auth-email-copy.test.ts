import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getResetPasswordEmailCopy,
  getVerifyEmailCopy,
  resolveAuthEmailLocale,
} from './auth-email-copy';

test('uses English for base-locale auth email URLs', () => {
  assert.equal(
    resolveAuthEmailLocale('https://beatapi.com/reset-password?token=abc'),
    'en'
  );
});

test('resolves Chinese auth email locale from localized URLs', () => {
  assert.equal(
    resolveAuthEmailLocale('https://beatapi.com/zh/reset-password?token=abc'),
    'zh'
  );
});

test('builds English verification email copy without Chinese text', () => {
  const copy = getVerifyEmailCopy({ locale: 'en', appName: 'BeatAPI' });
  assert.equal(copy.subject, 'Verify your email - BeatAPI');
  assert.doesNotMatch(Object.values(copy).join('\n'), /\p{Script=Han}/u);
});

test('builds English reset-password email copy without Chinese text', () => {
  const copy = getResetPasswordEmailCopy({
    locale: 'en',
    appName: 'BeatAPI',
    userName: 'Kai',
    url: 'https://beatapi.com/reset-password?token=abc',
  });
  assert.match(copy.subject, /Reset your BeatAPI password/);
  assert.match(copy.text, /Hi Kai,/);
  assert.match(copy.html, /Reset password/);
  assert.doesNotMatch([copy.subject, copy.text, copy.html].join('\n'), /\p{Script=Han}/u);
});
