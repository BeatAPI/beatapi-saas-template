import type { EffectMetadata } from '@/core/effects/client-api';
import { estimateCreditsForEffect } from '@/core/effects/pricing';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';

export function estimateComposerGenerationCredits({
  draftCard,
  model,
  metadata,
}: {
  draftCard: CanvasGenerationCard | null;
  model: WorkspaceModelOption | null;
  metadata?: EffectMetadata | null;
}) {
  if (!draftCard || !model || !metadata) {
    return null;
  }

  const estimated = estimateCreditsForEffect({
    effect: {
      id: metadata.id,
      credit: metadata.credit,
      provider: metadata.provider ?? null,
      inputSchema: metadata.inputSchema,
      pricingSchema: metadata.pricingSchema,
    },
    input: {
      aspect_ratio: draftCard.aspectRatio,
      mode: draftCard.mode,
      modelVariant: draftCard.variant,
      quality: draftCard.quality,
      size: draftCard.quality,
      wmDuration: draftCard.duration,
      wmOutputQuality: draftCard.outputQuality,
      wmSound: false,
    },
    mode: 'estimate',
  });

  if (estimated.credits === null) {
    return metadata.credit ?? null;
  }

  return estimated.credits;
}
