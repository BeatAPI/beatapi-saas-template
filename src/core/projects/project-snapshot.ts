import type {
  CanvasCard,
} from '@/core/beatcanvas/canvas-types';

export type ProjectSnapshotShapeFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ProjectSnapshotActiveTemplateWorkflow = {
  slug: string;
  title: string;
  source: string;
  taskType: CanvasCard['type'];
  enteredAt: string;
};

export type ProjectSnapshotDocument = {
  version: 3;
  cards: CanvasCard[];
  frames: Record<string, ProjectSnapshotShapeFrame>;
  workflows?: {
    activeTemplate?: ProjectSnapshotActiveTemplateWorkflow | null;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value : '';

const normalizeFrame = (value: unknown): ProjectSnapshotShapeFrame | null => {
  if (!isRecord(value)) {
    return null;
  }

  const x = value.x;
  const y = value.y;
  const w = value.w;
  const h = value.h;

  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(w) ||
    !isFiniteNumber(h)
  ) {
    return null;
  }

  return { x, y, w, h };
};

const normalizeActiveTemplateWorkflow = (
  value: unknown
): ProjectSnapshotActiveTemplateWorkflow | null => {
  if (!isRecord(value)) {
    return null;
  }

  const slug = normalizeString(value.slug);
  const title = normalizeString(value.title);
  const source = normalizeString(value.source) || 'template-library';
  const taskType = value.taskType === 'video' ? 'video' : 'image';
  const enteredAt = normalizeString(value.enteredAt);

  if (!slug || !title) {
    return null;
  }

  return {
    slug,
    title,
    source,
    taskType,
    enteredAt,
  };
};

const normalizeCard = (value: unknown): CanvasCard | null => {
  if (!isRecord(value)) {
    return null;
  }

  const referenceCardIds = Array.isArray(value.referenceCardIds)
    ? value.referenceCardIds.filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      )
    : [];

  const id = typeof value.id === 'string' ? value.id : null;
  const kind = typeof value.kind === 'string' ? value.kind : null;
  const type = typeof value.type === 'string' ? value.type : null;
  const name = typeof value.name === 'string' ? value.name : null;
  const workflowTemplateId =
    typeof value.workflowTemplateId === 'string'
      ? value.workflowTemplateId
      : null;
  const modelId =
    typeof value.modelId === 'string'
      ? value.modelId
      : '';

  if (!id || !kind || !type || !name) {
    return null;
  }

  return {
    id,
    assetId: typeof value.assetId === 'string' ? value.assetId : null,
    kind: kind as CanvasCard['kind'],
    type: type as CanvasCard['type'],
    name,
    url: typeof value.url === 'string' ? value.url : null,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    referenceCardIds,
    workflowTemplateId,
    status:
      typeof value.status === 'string'
        ? (value.status as CanvasCard['status'])
        : 'idle',
    error: typeof value.error === 'string' ? value.error : null,
    modelId,
    aspectRatio:
      typeof value.aspectRatio === 'string'
        ? (value.aspectRatio as CanvasCard['aspectRatio'])
        : '1:1',
    outputQuality:
      typeof value.outputQuality === 'string'
        ? (value.outputQuality as CanvasCard['outputQuality'])
        : '1k',
    duration:
      typeof value.duration === 'string'
        ? (value.duration as CanvasCard['duration'])
        : '5s',
    language:
      typeof value.language === 'string'
        ? (value.language as CanvasCard['language'])
        : undefined,
    mode:
      typeof value.mode === 'string'
        ? (value.mode as CanvasCard['mode'])
        : 'quality',
    variant:
      typeof value.variant === 'string'
        ? (value.variant as CanvasCard['variant'])
        : 'standard',
    quality:
      typeof value.quality === 'string'
        ? (value.quality as CanvasCard['quality'])
        : 'standard',
    sourceGenerationId:
      typeof value.sourceGenerationId === 'string'
        ? value.sourceGenerationId
        : null,
    sourceConfigCardId:
      typeof value.sourceConfigCardId === 'string'
        ? value.sourceConfigCardId
        : null,
    generationRunId:
      typeof value.generationRunId === 'string' ? value.generationRunId : null,
    generationSnapshot: isRecord(value.generationSnapshot)
      ? (value.generationSnapshot as CanvasCard['generationSnapshot'])
      : null,
    pinnedOutputId:
      typeof value.pinnedOutputId === 'string' ? value.pinnedOutputId : null,
  };
};

export const createEmptyProjectSnapshot = (): ProjectSnapshotDocument => ({
  version: 3,
  cards: [],
  frames: {},
});

export const normalizeProjectSnapshotDocument = (
  value: unknown
): ProjectSnapshotDocument => {
  if (!isRecord(value)) {
    return createEmptyProjectSnapshot();
  }

  const cards = Array.isArray(value.cards)
    ? value.cards
        .map(normalizeCard)
        .filter((item): item is CanvasCard => item !== null)
    : [];

  const framesRecord = isRecord(value.frames) ? value.frames : {};
  const frames = Object.entries(framesRecord).reduce<
    Record<string, ProjectSnapshotShapeFrame>
  >((accumulator, [cardId, frame]) => {
    const normalizedFrame = normalizeFrame(frame);
    if (normalizedFrame) {
      accumulator[cardId] = normalizedFrame;
    }
    return accumulator;
  }, {});

  const workflows = isRecord(value.workflows) ? value.workflows : {};
  const activeTemplate = normalizeActiveTemplateWorkflow(
    workflows.activeTemplate
  );
  const normalizedWorkflows = {
    ...(activeTemplate ? { activeTemplate } : {}),
  };

  return {
    version: 3,
    cards,
    frames,
    ...(Object.keys(normalizedWorkflows).length > 0
      ? {
          workflows: normalizedWorkflows,
        }
      : {}),
  };
};
