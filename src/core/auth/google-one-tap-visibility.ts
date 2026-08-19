const PUBLIC_ONE_TAP_PATHS = new Set(['/', '/pricing']);

export function shouldShowGoogleOneTap(pathname: string): boolean {
  return (
    PUBLIC_ONE_TAP_PATHS.has(pathname) ||
    pathname === '/templates' ||
    pathname.startsWith('/templates/')
  );
}
