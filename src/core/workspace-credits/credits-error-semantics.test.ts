import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const creditsSourceUrl = new URL('./credits.ts', import.meta.url);

test('database failures are not reported as a zero credit balance', async () => {
  const source = await readFile(creditsSourceUrl, 'utf8');
  const getCreditsBody = source.match(
    /export async function getUserCredits[\s\S]*?\n}\n\n\/\*\*/
  )?.[0];

  assert.ok(getCreditsBody, 'getUserCredits should exist');
  assert.doesNotMatch(getCreditsBody, /catch[\s\S]*?return 0/);
});

test('credit update failures are propagated to the caller', async () => {
  const source = await readFile(creditsSourceUrl, 'utf8');
  const updateCreditsBody = source.match(
    /export async function updateUserCredits[\s\S]*?\n}\n\n\/\*\*/
  )?.[0];

  assert.ok(updateCreditsBody, 'updateUserCredits should exist');
  assert.doesNotMatch(updateCreditsBody, /catch[\s\S]*?console\.error/);
});
