import { persistImageOutputIfNeeded } from './image-storage';
import { persistVideoOutputIfNeeded } from './video-storage';

export const OUTPUT_STORAGE_SYNC_RETRY_ERROR =
  'Output storage sync failed; waiting for retry';

export const didOutputStorageSyncFail = (output: unknown) =>
  Boolean(
    output &&
      typeof output === 'object' &&
      (output as Record<string, unknown>).storage_sync_failed === true
  );

export const shouldRetryOutputStorageSync = ({
  providerStatus,
  output,
}: {
  providerStatus: string;
  output: unknown;
}) => providerStatus === 'succeeded' && didOutputStorageSyncFail(output);

export const persistEffectOutputIfNeeded = async ({
  output,
  wmTaskId,
  effectId,
  effectType,
  userId,
}: {
  output: unknown;
  wmTaskId: string;
  effectId: number;
  effectType: number;
  userId?: string;
}) => {
  if (effectType === 1) {
    return persistVideoOutputIfNeeded({
      output,
      wmTaskId,
      effectId,
      userId,
    });
  }

  if (effectType === 2) {
    return persistImageOutputIfNeeded({
      output,
      wmTaskId,
      effectId,
      userId,
    });
  }

  return output;
};
