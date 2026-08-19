/**
 * Shim for @/i18n/routing and @/i18n/messages.
 */
export const DEFAULT_LOCALE = 'en';
export const LOCALES = ['en', 'zh'] as const;

export const routing = {
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  pathnames: {},
};

/**
 * Default (en) message tree. BeatAPI code accesses nested keys such as
 * `defaultMessages.Metadata.title`, so the shim mirrors that structure with
 * the base-locale values. Keys not listed here are still
 * reachable because the type is widened to a nested record.
 */
type Messages = {
  Metadata: {
    name: string;
    title: string;
    description: string;
    [key: string]: string;
  };
  [key: string]: any;
};

export const defaultMessages = {
  Metadata: {
    name: 'BeatAPI',
    title: 'BeatAPI | AI Creative Workspace',
    description:
      'Create campaign-ready images, videos, and variations in one AI workspace.',
  },
} as Messages;
