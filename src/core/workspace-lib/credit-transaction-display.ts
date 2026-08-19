const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readPositiveInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;

const normalizeModelLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeImageQuality = (value: unknown) => {
  const quality = readString(value)?.toLowerCase();
  return quality === 'low' || quality === 'medium' || quality === 'high'
    ? toTitleCase(quality)
    : null;
};

const normalizeMode = (value: unknown) => {
  const mode = readString(value)?.toLowerCase();
  return mode === 'fast' || mode === 'quality' ? toTitleCase(mode) : null;
};

const normalizeDuration = (value: unknown) => {
  const duration = readString(value);
  return duration && /^\d+s$/i.test(duration) ? duration : null;
};

const normalizeAspectRatio = (value: unknown) => {
  const ratio = readString(value);
  return ratio &&
    (/^\d+:\d+$/.test(ratio) ||
      /^\d{2,4}[x×]\d{2,4}$/i.test(ratio) ||
      ratio === 'auto' ||
      ratio === 'adaptive')
    ? ratio
    : null;
};

const normalizeOutputQuality = (value: unknown) => {
  const quality = readString(value);
  return quality &&
    (/^\d+k$/i.test(quality) ||
      /^\d{3,4}p$/i.test(quality) ||
      quality.toLowerCase() === 'std' ||
      quality.toLowerCase() === 'pro')
    ? quality.toUpperCase()
    : null;
};

const countReferenceImages = (input: Record<string, unknown>) => {
  const imageUrls = input.image_urls;
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter((item) => typeof item === 'string').length;
  }

  return readString(input.image_url) ? 1 : null;
};

export function formatCreditTransactionDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

export function formatGenerationDescription({
  input,
  effectName,
  effectType,
  fallback,
}: {
  input: unknown;
  effectName: string | null;
  effectType: number | null;
  fallback: string | null;
}) {
  const fallbackText = fallback ?? 'Generation';
  const normalizedName = effectName?.trim().replace(/\s+/g, ' ') || null;
  if (!normalizedName) {
    return fallbackText;
  }

  const generationLabel = effectType === 2 ? 'Image Generation' : 'Video Generation';

  if (new RegExp(`${generationLabel}$`, 'i').test(normalizedName)) {
    return normalizedName;
  }

  return `${normalizedName} ${generationLabel}`;
}

export function formatGenerationModelParams({
  input,
  effectName,
  effectModel,
}: {
  input: unknown;
  effectName: string | null;
  effectModel: string | null;
}) {
  const payload = isRecord(input) ? input : {};
  const modelName = effectName?.trim() || null;
  const modelId = effectModel?.trim() || readString(payload.model);
  const model =
    modelName &&
    modelId &&
    normalizeModelLabel(modelName) !== normalizeModelLabel(modelId)
      ? `${modelName} (${modelId})`
      : (modelName ?? modelId);

  const referenceCount = countReferenceImages(payload);
  const batchTotal = readPositiveInteger(payload.wmBatchTotal);
  const batchIndex = readPositiveInteger(payload.wmBatchIndex);
  const batchPart =
    batchTotal && batchIndex ? `Image ${batchIndex}/${batchTotal}` : null;
  const refsPart = referenceCount ? `${referenceCount} refs` : null;

  const parts = [
    model,
    batchPart,
    normalizeMode(payload.mode),
    normalizeDuration(payload.wmDuration),
    normalizeAspectRatio(payload.aspect_ratio),
    normalizeOutputQuality(payload.wmOutputQuality),
    normalizeImageQuality(payload.quality ?? payload.size),
    refsPart,
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(' | ') : null;
}
