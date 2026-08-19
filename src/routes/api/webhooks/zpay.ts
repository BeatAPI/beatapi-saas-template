import { createFileRoute } from '@tanstack/react-router';
import { handleZpayNotification } from '@/core/workspace-lib/payment/provider/zpay';

async function GET({ request }: { request: Request }): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;

  try {
    await handleZpayNotification(searchParams);
    return new Response('success', { status: 200 });
  } catch (error) {
    console.error('Error in ZPAY webhook route:', error);
    return new Response('fail', { status: 400 });
  }
}

export const Route = createFileRoute('/api/webhooks/zpay')({
  server: {
    handlers: { GET },
  },
});
