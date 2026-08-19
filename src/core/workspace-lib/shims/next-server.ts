/**
 * Shim for next/server - provides NextResponse equivalent.
 * In TanStack Start, API responses use standard Response.
 */
export class NextResponse extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
  }

  static json(data: any, init?: ResponseInit) {
    return Response.json(data, init);
  }

  static redirect(url: string, status?: number) {
    return Response.redirect(url, status || 307);
  }
}

export type NextRequest = Request;
