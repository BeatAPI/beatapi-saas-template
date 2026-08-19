export function canUseDevApiFallback(request: Pick<Request, 'url' | 'headers'>) {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const host =
      request.headers.get('host') || new URL(request.url).host || '';
    const hostname = host.split(':')[0]?.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function logDevApiFallback(route: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.warn(
    `[${route}] using local development fallback because the database request failed:`,
    error
  );
}
