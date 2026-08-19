import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import {
  createEmptyProjectSnapshot,
  type ProjectSnapshotDocument,
} from './project-snapshot';
import { m } from '@/paraglide/messages.js';

export const LOCAL_PREVIEW_PROJECT_ID = 'local-preview';

export function canUseLocalPreviewProject() {
  return process.env.NODE_ENV !== 'production';
}

export function createLocalPreviewGenerationHistorySnapshot(
  now = new Date()
): ProjectSnapshotDocument {
  const generationCard: CanvasCard = {
    id: 'shape:local-preview-generation',
    kind: 'generation',
    type: 'image',
    name: 'Cinematic forest study',
    url: '/app/create-thumb-forest.webp',
    prompt:
      'A cinematic forest at blue hour, soft volumetric light, restrained color palette.',
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: 'nano-banana-pro',
    aspectRatio: '1:1',
    outputQuality: '2k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    sourceGenerationId: null,
  };
  const makeOutput = ({
    id,
    name,
    url,
    status,
    error,
    minutesAgo,
  }: {
    id: string;
    name: string;
    url: string | null;
    status: CanvasCard['status'];
    error: string | null;
    minutesAgo: number;
  }): CanvasCard => ({
    ...generationCard,
    id,
    kind: 'output',
    name,
    url,
    status,
    error,
    referenceCardIds: [generationCard.id],
    sourceGenerationId: url ? `preview-task:${id}` : null,
    sourceConfigCardId: generationCard.id,
    generationRunId: `run:${id}`,
    generationSnapshot: {
      type: generationCard.type,
      prompt: generationCard.prompt,
      referenceCardIds: [],
      workflowTemplateId: null,
      modelId: generationCard.modelId,
      aspectRatio: generationCard.aspectRatio,
      outputQuality: generationCard.outputQuality,
      duration: generationCard.duration,
      mode: generationCard.mode,
      variant: generationCard.variant,
      quality: generationCard.quality,
      capturedAt: new Date(
        now.getTime() - minutesAgo * 60 * 1000
      ).toISOString(),
    },
  });

  return {
    version: 3,
    cards: [
      generationCard,
      makeOutput({
        id: 'output:preview-1',
        name: 'Character direction',
        url: '/app/create-thumb-character.webp',
        status: 'succeeded',
        error: null,
        minutesAgo: 18,
      }),
      makeOutput({
        id: 'output:preview-2',
        name: 'Material direction',
        url: null,
        status: 'failed',
        error: 'Generation did not complete',
        minutesAgo: 9,
      }),
      makeOutput({
        id: 'output:preview-3',
        name: 'Forest direction',
        url: '/app/create-thumb-forest.webp',
        status: 'succeeded',
        error: null,
        minutesAgo: 2,
      }),
    ],
    frames: {
      [generationCard.id]: { x: 460, y: 290, w: 380, h: 380 },
    },
  };
}

export function createLocalPreviewProjectState(
  locale: string,
  options?: { previewMode?: string }
) {
  const now = new Date();
  const messageLocale = locale.startsWith('zh') ? 'zh' : 'en';

  return {
    project: {
      id: LOCAL_PREVIEW_PROJECT_ID,
      userId: 'local-preview-user',
      name: m['BeatAPI.project.localPreviewCanvas'](
        {},
        { locale: messageLocale }
      ),
      coverAssetId: null,
      status: 'active',
      currentStateVersion: 1,
      lastOpenedAt: now,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    snapshotVersion: 1,
    snapshot:
      options?.previewMode === 'history'
        ? createLocalPreviewGenerationHistorySnapshot(now)
        : createEmptyProjectSnapshot(),
  };
}
