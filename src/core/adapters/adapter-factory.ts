import { BeatApiAdapter } from './beatapi-adapter';
import type { BaseAdapter, GenerationEffectRecord } from './base-adapter';

export const BUILT_IN_GENERATION_PROVIDER_IDS = ['beatapi'] as const;

export type GenerationAdapterFactory = (
  effect: GenerationEffectRecord
) => BaseAdapter;

const projectProviderFactories = new Map<string, GenerationAdapterFactory>();

const normalizeProviderId = (providerId: string) => {
  const normalized = providerId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new Error(
      'Generation provider id must use lowercase letters, numbers, dots, dashes, or underscores.'
    );
  }
  return normalized;
};

/**
 * Register a project-owned generation adapter without adding it to the
 * template's built-in provider catalog. BeatAPI remains the protected default.
 *
 * The returned function removes this exact registration, which is useful for
 * tests and development hot reloads.
 */
export const registerGenerationProvider = (
  providerId: string,
  factory: GenerationAdapterFactory
) => {
  const id = normalizeProviderId(providerId);
  if ((BUILT_IN_GENERATION_PROVIDER_IDS as readonly string[]).includes(id)) {
    throw new Error(`Built-in generation provider cannot be replaced: ${id}`);
  }

  projectProviderFactories.set(id, factory);

  return () => {
    if (projectProviderFactories.get(id) === factory) {
      projectProviderFactories.delete(id);
    }
  };
};

export const createAdapter = (effect: GenerationEffectRecord): BaseAdapter => {
  const providerId = normalizeProviderId(effect.provider);

  if (providerId === 'beatapi') {
    return new BeatApiAdapter(effect);
  }

  const projectFactory = projectProviderFactories.get(providerId);
  if (!projectFactory) {
    throw new Error(`Unsupported generation provider: ${effect.provider}`);
  }

  return projectFactory(effect);
};
