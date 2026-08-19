
import { getDb } from '@/core/workspace-lib/db-adapter';
import { effect } from '@/config/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const getEffectById = async (id: number) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(effect)
      .where(eq(effect.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
};

export const getEffectsByIds = async (ids: number[]) => {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) {
    return [];
  }

  try {
    const db = await getDb();
    return await db.select().from(effect).where(inArray(effect.id, uniqueIds));
  } catch {
    return [];
  }
};
