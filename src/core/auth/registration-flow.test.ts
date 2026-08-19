import assert from 'node:assert/strict';
import test from 'node:test';

import * as registrationFlow from './registration-flow';

type AuthFlowEnhancements = {
  classifyEmailSignInError?: (error: {
    code?: string;
    status?: number;
  } | null | undefined) => 'unverified' | 'credentials' | 'generic';
  getSafeAuthCallback?: (raw?: string | null) => string;
};

const enhancedRegistrationFlow = registrationFlow as typeof registrationFlow &
  AuthFlowEnhancements;

test('uses a six-character minimum password across auth flows', () => {
  assert.equal(registrationFlow.AUTH_PASSWORD_MIN_LENGTH, 6);
});

test('waits for verification email delivery before routing to the verification page', async () => {
  assert.equal(
    'completeEmailAuthHandoff' in registrationFlow
      ? typeof registrationFlow.completeEmailAuthHandoff
      : undefined,
    'function'
  );

  let sentParams: { email: string; callbackURL: string } | undefined;
  const destination = await registrationFlow.completeEmailAuthHandoff({
    email: ' Person@Example.com ',
    afterLoginUrl: '/canvas?from=signup',
    emailVerificationEnabled: true,
    localizeCallbackUrl: (href: string) => `/zh${href}`,
    sendVerificationEmail: async (params) => {
      sentParams = params;
    },
  });

  assert.deepEqual(sentParams, {
    email: 'person@example.com',
    callbackURL: '/zh/canvas?from=signup',
  });
  assert.equal(
    destination,
    '/verify-email?sent=confirmed&email=person%40example.com&callbackUrl=%2Fcanvas%3Ffrom%3Dsignup'
  );
});

test('surfaces verification delivery failures instead of redirecting as success', async () => {
  assert.equal(
    'completeEmailAuthHandoff' in registrationFlow
      ? typeof registrationFlow.completeEmailAuthHandoff
      : undefined,
    'function'
  );

  await assert.rejects(
    registrationFlow.completeEmailAuthHandoff({
      email: 'person@example.com',
      afterLoginUrl: '/settings',
      emailVerificationEnabled: true,
      localizeCallbackUrl: (href: string) => href,
      sendVerificationEmail: async () => {
        throw new Error('provider unavailable');
      },
    }),
    /provider unavailable/
  );
});

test('routes directly without sending email when verification is disabled', async () => {
  assert.equal(
    'completeEmailAuthHandoff' in registrationFlow
      ? typeof registrationFlow.completeEmailAuthHandoff
      : undefined,
    'function'
  );

  let sendCount = 0;
  const destination = await registrationFlow.completeEmailAuthHandoff({
    email: 'person@example.com',
    afterLoginUrl: '/settings',
    emailVerificationEnabled: false,
    localizeCallbackUrl: (href: string) => href,
    sendVerificationEmail: async () => {
      sendCount += 1;
    },
  });

  assert.equal(destination, '/settings');
  assert.equal(sendCount, 0);
});

test('defaults post-verification navigation to the homepage when no source exists', async () => {
  let sentParams: { email: string; callbackURL: string } | undefined;
  const destination = await registrationFlow.completeEmailAuthHandoff({
    email: 'person@example.com',
    afterLoginUrl: undefined,
    emailVerificationEnabled: true,
    localizeCallbackUrl: (href: string) => href,
    sendVerificationEmail: async (params) => {
      sentParams = params;
    },
  });

  assert.deepEqual(sentParams, {
    email: 'person@example.com',
    callbackURL: '/',
  });
  assert.equal(
    destination,
    '/verify-email?sent=confirmed&email=person%40example.com&callbackUrl=%2F'
  );
});

test('builds a browser handoff URL instead of exposing the verification API to mail scanners', () => {
  const sampleVerificationValue = 'unit-test-value';
  const buildEmailVerificationHandoffUrl =
    'buildEmailVerificationHandoffUrl' in registrationFlow
      ? registrationFlow.buildEmailVerificationHandoffUrl
      : undefined;

  assert.ok(buildEmailVerificationHandoffUrl);
  assert.equal(
    buildEmailVerificationHandoffUrl({
      baseUrl: 'https://beatapi.net',
      token: sampleVerificationValue,
      callbackURL: '/projects/123?from=signup',
    }),
    'https://beatapi.net/verify-email-complete#token=unit-test-value&callbackURL=%2Fprojects%2F123%3Ffrom%3Dsignup'
  );
});

test('browser handoff forwards only the verification token and safe callback to Better Auth', () => {
  const getEmailVerificationCompletionPath =
    'getEmailVerificationCompletionPath' in registrationFlow
      ? registrationFlow.getEmailVerificationCompletionPath
      : undefined;

  assert.ok(getEmailVerificationCompletionPath);
  assert.equal(
    getEmailVerificationCompletionPath(
      '#token=signed-token&callbackURL=%2Fprojects%2F123%3Ffrom%3Dsignup'
    ),
    '/api/auth/verify-email?token=signed-token&callbackURL=%2Fprojects%2F123%3Ffrom%3Dsignup'
  );
  assert.equal(
    getEmailVerificationCompletionPath(
      '#token=signed-token&callbackURL=https%3A%2F%2Fevil.example%2Fsteal'
    ),
    '/api/auth/verify-email?token=signed-token&callbackURL=%2F'
  );
  assert.equal(
    getEmailVerificationCompletionPath(
      '#token=signed-token&callbackURL=%2F%5Cevil.example%2Fsteal'
    ),
    '/api/auth/verify-email?token=signed-token&callbackURL=%2F'
  );
  assert.equal(getEmailVerificationCompletionPath('#callbackURL=%2Fsettings'), null);
});

test('distinguishes unverified email from invalid credentials by Better Auth error code', () => {
  assert.equal(
    typeof enhancedRegistrationFlow.classifyEmailSignInError,
    'function'
  );
  assert.equal(
    enhancedRegistrationFlow.classifyEmailSignInError!({
      code: 'EMAIL_NOT_VERIFIED',
      status: 403,
    }),
    'unverified'
  );
  assert.equal(
    enhancedRegistrationFlow.classifyEmailSignInError!({
      code: 'INVALID_EMAIL_OR_PASSWORD',
      status: 401,
    }),
    'credentials'
  );
  assert.equal(
    enhancedRegistrationFlow.classifyEmailSignInError!({ status: 403 }),
    'generic'
  );
});

test('accepts only safe relative post-auth callbacks', () => {
  assert.equal(typeof enhancedRegistrationFlow.getSafeAuthCallback, 'function');
  assert.equal(
    enhancedRegistrationFlow.getSafeAuthCallback!('/canvas/123?from=login'),
    '/canvas/123?from=login'
  );
  assert.equal(
    enhancedRegistrationFlow.getSafeAuthCallback!('https://evil.example/steal'),
    '/'
  );
  assert.equal(
    enhancedRegistrationFlow.getSafeAuthCallback!('//evil.example/steal'),
    '/'
  );
  assert.equal(
    enhancedRegistrationFlow.getSafeAuthCallback!('/\\evil.example/steal'),
    '/'
  );
  assert.equal(enhancedRegistrationFlow.getSafeAuthCallback!('/sign-in'), '/');
  assert.equal(
    enhancedRegistrationFlow.getSafeAuthCallback!('/verify-email'),
    '/'
  );
});
