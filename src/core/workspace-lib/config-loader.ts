
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MARKETING_CONFIG_DIR = path.join(
  process.cwd(),
  'src',
  'config',
  'pages',
  'marketing'
);

type PageSection = {
  type: string;
  key: string;
  template?: string;
  image?: string;
};

export type BasePageConfig = {
  slug: string;
  i18nKey: string;
  metadataKey: string;
  sections: PageSection[];
};

type ConfigResult<T> = {
  data?: T;
  error?: string;
  errors?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isSections = (value: unknown): value is PageSection[] => {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!isRecord(item) || !isString(item.type) || !isString(item.key)) {
      return false;
    }
    if (item.template !== undefined && !isString(item.template)) {
      return false;
    }
    if (item.image !== undefined && !isString(item.image)) {
      return false;
    }
    return true;
  });
};

const validateBaseConfig = (config: Record<string, unknown>): string[] => {
  const errors: string[] = [];
  if (!isString(config.slug)) errors.push('slug is required');
  if (!isString(config.i18nKey)) errors.push('i18nKey is required');
  if (!isString(config.metadataKey)) errors.push('metadataKey is required');
  if (!isSections(config.sections)) errors.push('sections must be an array');
  return errors;
};

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
};

const loadMarketingFile = async (slug: string) => {
  const filePath = path.join(MARKETING_CONFIG_DIR, `${slug}.json`);
  return readJsonFile(filePath);
};

export const loadMarketingConfig = async (
  slug: string
): Promise<ConfigResult<BasePageConfig>> => {
  try {
    const data = await loadMarketingFile(slug);
    if (!isRecord(data)) {
      return { error: 'Invalid config format', errors: ['Invalid JSON'] };
    }
    const errors = validateBaseConfig(data);
    if (errors.length > 0) {
      return { error: 'Invalid config', errors };
    }
    return { data: data as BasePageConfig };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Config not found',
    };
  }
};

export const listMarketingConfigSlugs = async () => {
  try {
    const files = await fs.readdir(MARKETING_CONFIG_DIR);
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));
  } catch {
    return [] as string[];
  }
};
