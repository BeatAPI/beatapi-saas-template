import { createFileRoute } from '@tanstack/react-router';
import { getEffectsByIds } from '@/core/effects/effects';

type EffectRow = {
  id: number;
  name: string;
  isOpen: number | null;
  credit: number;
  inputSchema: unknown;
  pricingSchema: unknown;
};

const parseIds = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const ids = parseIds(searchParams.get('ids'));

  if (ids.length === 0) {
    return Response.json({ error: 'ids is required' }, { status: 400 });
  }

  const effects = (await getEffectsByIds(ids)) as EffectRow[];
  const metadata = Object.fromEntries(
    effects.map((item) => [
      String(item.id),
      {
        id: item.id,
        name: item.name,
        isOpen: item.isOpen,
        credit: item.credit,
        inputSchema: item.inputSchema,
        pricingSchema: item.pricingSchema,
      },
    ])
  );

  return Response.json({
    effects: metadata,
  });
}

export const Route = createFileRoute('/api/effects/metadata')({
  server: {
    handlers: { GET },
  },
});
