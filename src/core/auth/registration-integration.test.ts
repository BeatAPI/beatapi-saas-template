import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const authServer = read('src/core/auth/index.ts');
const modal = read('src/components/auth/login-wrapper.tsx');
const signUpPage = read('src/routes/(auth)/sign-up.tsx');
const signInPage = read('src/routes/(auth)/sign-in.tsx');
const verifyEmailPage = read('src/routes/(auth)/verify-email.tsx');
const verifyEmailCompletePagePath = 'src/routes/(auth)/verify-email-complete.tsx';
const verifyEmailCompletePage = existsSync(verifyEmailCompletePagePath)
  ? read(verifyEmailCompletePagePath)
  : '';
const resetPasswordPage = read('src/routes/(auth)/reset-password.tsx');
const forgotPasswordPage = read('src/routes/(auth)/forgot-password.tsx');
const accountCenter = read('src/components/account/account-center-dialog.tsx');
const verificationEmailRoutePath = 'src/routes/api/auth/verification-email.ts';
const verificationEmailRoute = existsSync(verificationEmailRoutePath)
  ? read(verificationEmailRoutePath)
  : '';

test('server and all password-setting clients share the six-character minimum', () => {
  assert.match(authServer, /minPasswordLength:\s*AUTH_PASSWORD_MIN_LENGTH/);
  assert.match(signUpPage, /\.min\(\s*AUTH_PASSWORD_MIN_LENGTH/);
  assert.match(resetPasswordPage, /\.min\(\s*AUTH_PASSWORD_MIN_LENGTH/);
  assert.match(accountCenter, /newPassword\.length < AUTH_PASSWORD_MIN_LENGTH/);

  const passwordSources = [authServer, modal, signUpPage, resetPasswordPage, accountCenter].join('\n');
  assert.doesNotMatch(passwordSources, /\.min\(8\)|password\.length < 8|newPassword\.length < 8/);
});

test('modal and standalone auth pages use the shared verification handoff', () => {
  for (const source of [modal, signUpPage, signInPage]) {
    assert.match(source, /completeEmailAuthHandoff/);
  }

  assert.doesNotMatch(modal, /window\.location\.href = localizeHref\(nextUrl\)/);
  assert.doesNotMatch(signUpPage, /void authClient\.sendVerificationEmail/);
  assert.doesNotMatch(signInPage, /void authClient\.sendVerificationEmail/);
});

test('all verification actions use the reliable application endpoint', () => {
  for (const source of [modal, signUpPage, signInPage, verifyEmailPage]) {
    assert.match(source, /apiPost\(["']\/api\/auth\/verification-email["']/);
    assert.doesNotMatch(source, /authClient\.sendVerificationEmail/);
  }
});

test('auth forms never fall back to GET and expose credentials in the URL', () => {
  for (const source of [
    modal,
    signUpPage,
    signInPage,
    resetPasswordPage,
    forgotPasswordPage,
  ]) {
    assert.match(source, /<form[\s\S]{0,100}?method=["']post["']/);
  }
});

test('reliable verification endpoint owns token creation and delivery errors', () => {
  assert.match(verificationEmailRoute, /createEmailVerificationToken/);
  assert.match(verificationEmailRoute, /if \(!result\.success\)/);
  assert.match(verificationEmailRoute, /return respErr\(/);
  assert.match(verificationEmailRoute, /emailVerified/);
  assert.match(verificationEmailRoute, /hasTrustedOrigin/);
  assert.match(verificationEmailRoute, /includeCookie:\s*false/);
  assert.match(verificationEmailRoute, /getSafeCallbackPath/);
  assert.match(verificationEmailRoute, /buildEmailVerificationHandoffUrl/);
  assert.doesNotMatch(verificationEmailRoute, /new URL\(['"]\/api\/auth\/verify-email/);
});

test('verification completes in the user browser and defaults standalone auth to home', () => {
  assert.match(authServer, /autoSignInAfterVerification:\s*true/);
  assert.match(verifyEmailCompletePage, /getEmailVerificationCompletionPath/);
  assert.match(verifyEmailCompletePage, /window\.location\.hash/);
  assert.match(verifyEmailCompletePage, /window\.location\.replace/);
  assert.match(verifyEmailCompletePage, /name:\s*['"]referrer['"],\s*content:\s*['"]no-referrer['"]/);
  for (const source of [signUpPage, signInPage]) {
    assert.match(
      source,
      /getSafeAuthCallback\(params\.get\(['"]callbackUrl['"]\)\)/
    );
  }
});

test('English and Chinese password guidance says six characters', () => {
  const en = JSON.parse(read('messages/en.json'));
  const zh = JSON.parse(read('messages/zh.json'));

  assert.match(en['common.sign.password_min_length'], /6/);
  assert.match(zh['common.sign.password_min_length'], /6/);
  assert.match(en.BeatAPI.auth.passwordMinLength, /6/);
  assert.match(zh.BeatAPI.auth.passwordMinLength, /6/);
  assert.match(en.BeatAPI.account.newPasswordMinLength, /6/);
  assert.match(zh.BeatAPI.account.newPasswordMinLength, /6/);
});
