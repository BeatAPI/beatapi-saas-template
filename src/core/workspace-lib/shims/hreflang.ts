// Shim for BeatAPI's @/lib/hreflang. Signatures mirror the original
// (src/lib/hreflang.ts) so callers copied from BeatAPI need no edits.
// Locale is accepted loosely to avoid importing next-intl types here.

export function generateAlternates(_href: string): Record<string, unknown> {
  return {};
}

export function getCurrentHreflang(_locale?: string): string {
  return 'zh';
}

export function generateHreflangTags(_baseUrl: string, _path: string): string[] {
  return [];
}
