
export type EffectsQueueSource = 'generate' | 'callback' | 'retry';

export type EffectsStatusCheckMessage = {
  wmTaskId: string;
  userId: string;
  effectId: number;
  attempt: number;
  source: EffectsQueueSource;
};

export type EnqueueResult = {
  enqueued: boolean;
  reason?: string;
};

export const enqueueEffectsStatusCheck = async (
  _message: EffectsStatusCheckMessage
): Promise<EnqueueResult> => {
  return {
    enqueued: false,
    reason:
      'Cloudflare Cron DB polling handles effects status checks in production',
  };
};
