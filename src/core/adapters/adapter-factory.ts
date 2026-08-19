import type { effect as effectTable } from '@/config/db/schema';
import { BeatApiAdapter } from './beatapi-adapter';
import { MockAdapter } from './mock-adapter';

type EffectRecord = typeof effectTable.$inferSelect;

export const createAdapter = (effect: EffectRecord) => {
  switch (effect.provider) {
    case 'beatapi':
      return new BeatApiAdapter(effect);
    case 'mock':
      return new MockAdapter(effect);
    default:
      return new MockAdapter(effect);
  }
};
