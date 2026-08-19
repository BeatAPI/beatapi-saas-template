import { createFileRoute } from '@tanstack/react-router';

async function POST() {
  return Response.json(
    {
      error:
        'Legacy upload endpoint removed. Use /api/storage/presign instead.',
    },
    { status: 410 }
  );
}

export const Route = createFileRoute('/api/storage/upload')({
  server: {
    handlers: { POST },
  },
});
