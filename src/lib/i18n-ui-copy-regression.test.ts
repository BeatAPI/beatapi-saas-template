import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const enMessages = JSON.parse(read('messages/en.json')) as Record<string, string>;
const zhMessages = JSON.parse(read('messages/zh.json')) as Record<string, string>;

const requiredKeys = [
  'common.sign.sign_in_failed',
  'common.sign.sign_up_failed',
  'common.sign.reset_password_request_failed',
  'common.sign.reset_password_failed',
  'common.ui.open_menu',
  'common.ui.close_menu',
  'common.upload.drop_to_upload',
  'common.upload.preview',
] as const;

test('shared UI fallback copy has English and Chinese message keys', () => {
  for (const key of requiredKeys) {
    assert.equal(typeof enMessages[key], 'string', `${key} missing in English`);
    assert.notEqual(enMessages[key].trim(), '', `${key} is empty in English`);
    assert.equal(typeof zhMessages[key], 'string', `${key} missing in Chinese`);
    assert.notEqual(zhMessages[key].trim(), '', `${key} is empty in Chinese`);
  }
});

test('image uploader uses localized drag and preview copy', () => {
  const source = read('src/components/image-uploader.tsx');

  assert.doesNotMatch(source, /Drop to upload/);
  assert.doesNotMatch(source, /alt="Preview"/);
  assert.match(source, /common\.upload\.drop_to_upload/);
  assert.match(source, /common\.upload\.preview/);
});

test('auth pages use localized fallback errors', () => {
  const files = [
    'src/routes/(auth)/sign-in.tsx',
    'src/routes/(auth)/sign-up.tsx',
    'src/routes/(auth)/forgot-password.tsx',
    'src/routes/(auth)/reset-password.tsx',
  ];

  const joined = files.map((file) => read(file)).join('\n');

  assert.doesNotMatch(joined, /Sign in failed|Sign up failed|Request failed|Reset failed/);
  assert.match(joined, /common\.sign\.sign_in_failed/);
  assert.match(joined, /common\.sign\.sign_up_failed/);
  assert.match(joined, /common\.sign\.reset_password_request_failed/);
  assert.match(joined, /common\.sign\.reset_password_failed/);
});

test('site header uses localized mobile menu labels', () => {
  const source = read('src/components/site-header.tsx');

  assert.doesNotMatch(source, /Close menu|Open menu/);
  assert.match(source, /common\.ui\.close_menu/);
  assert.match(source, /common\.ui\.open_menu/);
});
