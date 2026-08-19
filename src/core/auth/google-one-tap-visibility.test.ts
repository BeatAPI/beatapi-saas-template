import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowGoogleOneTap } from './google-one-tap-visibility';

test('Google One Tap stays off authenticated workspace and admin surfaces', () => {
  assert.equal(shouldShowGoogleOneTap('/'), true);
  assert.equal(shouldShowGoogleOneTap('/pricing'), true);
  assert.equal(shouldShowGoogleOneTap('/templates/product-photo'), true);
  assert.equal(shouldShowGoogleOneTap('/sign-in'), false);
  assert.equal(shouldShowGoogleOneTap('/projects/123'), false);
  assert.equal(shouldShowGoogleOneTap('/admin/settings'), false);
  assert.equal(shouldShowGoogleOneTap('/settings/profile'), false);
});
