import { resolvePersistedGeneratedMedia } from '@/core/workspace-lib/app/persisted-generated-workspace-media';

export type GeneratedWorkspaceItemStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export type GeneratedWorkspaceItem = {
  id: string;
  taskId: string;
  status: GeneratedWorkspaceItemStatus;
  prompt: string | null;
  modelLabel: string | null;
  paramsLabel: string | null;
  assetType: 'image' | 'video';
  mediaUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
};

export type FeedGenerationRecord = {
  id: string;
  status: string;
  input: unknown;
  output: unknown;
  createdAt: Date;
  effectName: string | null;
  effectType: number | null;
};

export type FeedLinkedAssetRecord = {
  role: string;
  generationId: string;
  publicUrl: string | null;
  createdAt: Date | null;
};

type AssetOutputRecord = {
  publicUrl: string | null;
  createdAt: Date | null;
};

const keepLatestAssetRecord = ({
  map,
  generationId,
  candidate,
}: {
  map: Map<string, AssetOutputRecord>;
  generationId: string;
  candidate: AssetOutputRecord;
}) => {
  const existing = map.get(generationId);

  if (!existing) {
    map.set(generationId, candidate);
    return;
  }

  map.set(
    generationId,
    (existing.createdAt ?? new Date(0)) > (candidate.createdAt ?? new Date(0))
      ? existing
      : candidate
  );
};

const formatDuration = (value: unknown) =>
  typeof value === 'string' && /^\d+s$/i.test(value) ? value : null;

const formatStandardParams = (input: unknown) => {
  if (!input || typeof input !== 'object') return null;
  const payload = input as Record<string, unknown>;
  const mode =
    payload.mode === 'fast'
      ? 'Fast'
      : payload.mode === 'quality'
        ? 'Quality'
        : null;
  const duration = formatDuration(payload.wmDuration);
  const aspectRatio =
    payload.aspect_ratio === '16:9' ||
    payload.aspect_ratio === '21:9' ||
    payload.aspect_ratio === '4:3' ||
    payload.aspect_ratio === '9:16' ||
    payload.aspect_ratio === '1:1' ||
    payload.aspect_ratio === '3:4' ||
    payload.aspect_ratio === '2:3' ||
    payload.aspect_ratio === '3:2' ||
    payload.aspect_ratio === 'adaptive' ||
    payload.aspect_ratio === 'auto'
      ? payload.aspect_ratio
      : null;
  const quality =
    payload.wmOutputQuality === '480p' ||
    payload.wmOutputQuality === '720p' ||
    payload.wmOutputQuality === '1080p' ||
    payload.wmOutputQuality === '4k'
      ? payload.wmOutputQuality.toUpperCase()
      : null;

  const parts = [mode, duration, aspectRatio, quality].filter(
    (value): value is string => Boolean(value)
  );
  return parts.length > 0 ? parts.join(' | ') : null;
};

export const mapGeneratedWorkspaceBatch = ({
  generations,
  linkedAssets,
}: {
  generations: FeedGenerationRecord[];
  linkedAssets: FeedLinkedAssetRecord[];
}): GeneratedWorkspaceItem[] => {
  const outputMap = new Map<string, AssetOutputRecord>();
  const thumbnailMap = new Map<string, AssetOutputRecord>();

  for (const item of linkedAssets) {
    const candidate: AssetOutputRecord = {
      publicUrl: item.publicUrl,
      createdAt: item.createdAt,
    };

    if (item.role === 'thumbnail') {
      keepLatestAssetRecord({
        map: thumbnailMap,
        generationId: item.generationId,
        candidate,
      });
      continue;
    }

    keepLatestAssetRecord({
      map: outputMap,
      generationId: item.generationId,
      candidate,
    });
  }

  return generations
    .map((item): GeneratedWorkspaceItem | null => {
      const input = item.input as Record<string, unknown> | null;
      const output = item.output as Record<string, unknown> | null;
      const prompt =
        input && typeof input.prompt === 'string' ? input.prompt : null;
      const modelLabel = item.effectName ?? null;
      const paramsLabel = formatStandardParams(input);
      const linkedOutput = outputMap.get(item.id) ?? null;
      const inferredAssetType = item.effectType === 2 ? 'image' : 'video';
      const assetType = inferredAssetType;
      const qualityFinalized = output && output.quality_finalized === true;
      const status: GeneratedWorkspaceItemStatus = qualityFinalized
        ? 'succeeded'
        : item.status === 'succeeded'
          ? 'succeeded'
          : item.status === 'failed'
            ? 'failed'
            : item.status === 'pending'
              ? 'pending'
              : 'processing';
      const stableMedia = resolvePersistedGeneratedMedia({
        status,
        assetType,
        linkedOutput,
      });

      if (!stableMedia) {
        return null;
      }

      return {
        id: item.id,
        taskId: item.id,
        status,
        prompt,
        modelLabel,
        paramsLabel,
        assetType,
        mediaUrl: stableMedia.mediaUrl,
        videoUrl: stableMedia.videoUrl,
        createdAt: item.createdAt.toISOString(),
      };
    })
    .filter((item): item is GeneratedWorkspaceItem => item !== null);
};

export const collectGeneratedWorkspaceItems = async ({
  limit = 60,
  pageSize = 12,
  fetchGenerationPage,
  fetchLinkedAssets,
}: {
  limit?: number | null;
  pageSize?: number;
  fetchGenerationPage: (args: {
    offset: number;
    limit: number;
  }) => Promise<FeedGenerationRecord[]>;
  fetchLinkedAssets: (
    generationIds: string[]
  ) => Promise<FeedLinkedAssetRecord[]>;
}): Promise<GeneratedWorkspaceItem[]> => {
  const normalizedLimit = typeof limit === 'number' ? Math.max(1, limit) : null;
  const batchSize = normalizedLimit
    ? Math.max(normalizedLimit, pageSize)
    : pageSize;
  const visibleItems: GeneratedWorkspaceItem[] = [];
  let offset = 0;

  while (normalizedLimit === null || visibleItems.length < normalizedLimit) {
    const generations = await fetchGenerationPage({
      offset,
      limit: batchSize,
    });

    if (generations.length === 0) {
      break;
    }

    const generationIds = generations.map((item) => item.id);
    const linkedAssets =
      generationIds.length > 0 ? await fetchLinkedAssets(generationIds) : [];

    visibleItems.push(
      ...mapGeneratedWorkspaceBatch({
        generations,
        linkedAssets,
      })
    );

    offset += generations.length;

    if (generations.length < batchSize) {
      break;
    }
  }

  return normalizedLimit === null
    ? visibleItems
    : visibleItems.slice(0, normalizedLimit);
};
