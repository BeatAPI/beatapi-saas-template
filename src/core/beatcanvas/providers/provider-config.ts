export const BEATCANVAS_PROVIDER_IDS = ['beatapi'] as const;

export type BeatCanvasProviderId =
  (typeof BEATCANVAS_PROVIDER_IDS)[number];

export type BeatCanvasProviderPublicConfig = {
  id: BeatCanvasProviderId;
  label: string;
  isDefault: boolean;
  supports: readonly ['image', 'video'];
};

export type BeatCanvasProviderServerConfig =
  BeatCanvasProviderPublicConfig & {
    baseUrl: string;
    apiKey: string;
  };

export const DEFAULT_BEATAPI_BASE_URL = 'https://api.beatapi.io';

export const resolveBeatCanvasProviderId = (
  _value: string | null | undefined
): BeatCanvasProviderId => 'beatapi';

export const getBeatCanvasProviderPublicConfig = (
  providerId: string | null | undefined
): BeatCanvasProviderPublicConfig => {
  const id = resolveBeatCanvasProviderId(providerId);

  return {
    id,
    label: 'BeatAPI',
    isDefault: true,
    supports: ['image', 'video'],
  };
};

export const getBeatCanvasProviderServerConfig = ({
  providerId,
  baseUrl,
  apiKey,
}: {
  providerId?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
} = {}): BeatCanvasProviderServerConfig => {
  const publicConfig = getBeatCanvasProviderPublicConfig(providerId);

  return {
    ...publicConfig,
    baseUrl: (baseUrl || DEFAULT_BEATAPI_BASE_URL).replace(/\/$/, ''),
    apiKey: apiKey || '',
  };
};
