import type { effect as effectTable } from '@/config/db/schema';

type EffectRecord = typeof effectTable.$inferSelect;

export type GenerationResult = {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  output?: unknown;
  error?: string;
};

export abstract class BaseAdapter {
  protected effect: EffectRecord;

  constructor(effect: EffectRecord) {
    this.effect = effect;
  }

  abstract createGeneration(input: unknown): Promise<GenerationResult>;

  async checkStatus?(taskId: string): Promise<GenerationResult>;

  async get1080pVideo?(
    taskId: string,
    index?: number
  ): Promise<GenerationResult>;

  async get4kVideo?(
    taskId: string,
    index?: number
  ): Promise<GenerationResult>;

  estimateCost?(input: unknown): number;
}
