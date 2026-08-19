/**
 * Shim: provides `auth` object stub for BeatAPI server-side code.
 * Real auth integration happens in API routes (Block 3).
 */
export const auth = {
  api: {
    getSession: async () => null,
    getSessionCookie: () => null,
  },
  handler: async () => new Response('OK'),
} as any;
