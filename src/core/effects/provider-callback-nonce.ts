
import { randomUUID } from 'node:crypto';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { providerCallbackNonce } from '@/config/db/schema';
import { lt } from 'drizzle-orm';

export const consumeProviderCallbackNonce = async ({
  provider,
  nonce,
  expiresAt,
}: {
  provider: string;
  nonce: string;
  expiresAt: Date;
}) => {
  try {
    const db = await getDb();
    await db
      .delete(providerCallbackNonce)
      .where(lt(providerCallbackNonce.expiresAt, new Date()));

    const inserted = await db
      .insert(providerCallbackNonce)
      .values({
        id: randomUUID(),
        provider,
        nonce,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: providerCallbackNonce.id });

    if (inserted.length === 0) {
      return {
        ok: false,
        status: 409,
        error: 'Duplicate callback nonce',
      } as const;
    }

    return { ok: true } as const;
  } catch (error) {
    console.error('consumeProviderCallbackNonce error:', error);
    return {
      ok: false,
      status: 500,
      error: 'Callback nonce store unavailable',
    } as const;
  }
};
