import { createFileRoute } from '@tanstack/react-router';
import { resolveWorkspaceEffectProviderModelVariant } from '@/core/effects/effect-registry';
import { getEffectsByIds } from '@/core/effects/effects';
import {
  type WorkspaceType,
  getWorkspaceModelsByType,
} from '@/core/effects/workspace-models';

type EffectRow = {
  id: number;
  name: string;
  isOpen: number | null;
  credit: number;
  inputSchema: unknown;
  pricingSchema: unknown;
};

const isWorkspaceType = (value: string | null): value is WorkspaceType =>
  value === 'ai-image' || value === 'ai-video';

async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get('type');
  const types = isWorkspaceType(requestedType)
    ? [requestedType]
    : (['ai-image', 'ai-video'] as const);

  const registryModels = types.flatMap((type) =>
    getWorkspaceModelsByType(type).map((model) => ({
      ...model,
      workspaceType: type,
    }))
  );
  const effects = (await getEffectsByIds(
    registryModels.map((model) => model.effectId)
  )) as EffectRow[];
  const effectsById = new Map<number, EffectRow>(
    effects.map((effect) => [effect.id, effect])
  );

  const models = registryModels.map((model) => {
    const effect = effectsById.get(model.effectId);

    return {
      ...model,
      credit: effect?.credit ?? null,
      inputSchema: effect?.inputSchema ?? null,
      pricingSchema: effect?.pricingSchema ?? null,
      defaultProviderModelVariant: model.defaultVariant
        ? resolveWorkspaceEffectProviderModelVariant({
            modelId: model.id,
            variant: model.defaultVariant,
          })
        : null,
      available: effect ? effect.isOpen !== 0 : false,
    };
  });

  return Response.json({ models });
}

export const Route = createFileRoute('/api/app/effects/models')({
  server: {
    handlers: { GET },
  },
});
