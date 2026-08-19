/**
 * Shim for next/headers - provides headers() and cookies() equivalents.
 * In TanStack Start, these are accessed via getWebRequest() / getEvent().
 */
export async function headers(): Promise<Headers> {
  return new Headers();
}

export async function cookies() {
  return {
    get: (name: string) => undefined,
    getAll: () => [],
    set: (_name: string, _value: string, _options?: any) => {},
    delete: (_name: string) => {},
  };
}
