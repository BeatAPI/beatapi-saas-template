import type { effect as effectTable } from '@/config/db/schema';
import { BeatApiAdapter } from './beatapi-adapter';

type EffectRecord = typeof effectTable.$inferSelect;

export const createAdapter = (effect: EffectRecord) => {
  if (effect.provider !== 'beatapi') {
    throw new Error(`Unsupported generation provider: ${effect.provider}`);
  }

  return new BeatApiAdapter(effect);
};
