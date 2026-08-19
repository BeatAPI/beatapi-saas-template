
import { getDb } from '@/core/workspace-lib/db-adapter';
import {
  effect,
  generationAssetLink,
  generationHistory,
  userAsset,
} from '@/config/db/schema';
import {
  type FeedGenerationRecord,
  type FeedLinkedAssetRecord,
  type GeneratedWorkspaceItem,
  type GeneratedWorkspaceItemStatus,
  collectGeneratedWorkspaceItems,
} from '@/core/workspace-lib/app/generated-workspace-feed-core';
import { and, desc, eq, inArray } from 'drizzle-orm';

export type { GeneratedWorkspaceItem, GeneratedWorkspaceItemStatus };

const GENERATED_WORKSPACE_FEED_PAGE_SIZE = 12;

export const loadGeneratedWorkspaceFeed = async ({
  userId,
  limit = 60,
}: {
  userId: string;
  limit?: number | null;
}): Promise<GeneratedWorkspaceItem[]> => {
  const db = await getDb();

  return collectGeneratedWorkspaceItems({
    limit,
    pageSize: GENERATED_WORKSPACE_FEED_PAGE_SIZE,
    fetchGenerationPage: async ({ offset, limit: pageLimit }) => {
      const generations = await db
        .select({
          id: generationHistory.id,
          status: generationHistory.status,
          input: generationHistory.input,
          output: generationHistory.output,
          createdAt: generationHistory.createdAt,
          effectName: effect.name,
          effectType: effect.type,
        })
        .from(generationHistory)
        .leftJoin(effect, eq(effect.id, generationHistory.effectId))
        .where(and(eq(generationHistory.userId, userId)))
        .orderBy(desc(generationHistory.createdAt), desc(generationHistory.id))
        .limit(pageLimit)
        .offset(offset);

      return generations satisfies FeedGenerationRecord[];
    },
    fetchLinkedAssets: async (generationIds) => {
      if (generationIds.length === 0) {
        return [];
      }

      const linkedAssets = await db
        .select({
          role: generationAssetLink.role,
          generationId: generationAssetLink.generationId,
          publicUrl: userAsset.publicUrl,
          createdAt: userAsset.createdAt,
        })
        .from(generationAssetLink)
        .leftJoin(userAsset, eq(userAsset.id, generationAssetLink.assetId))
        .where(
          and(
            inArray(generationAssetLink.generationId, generationIds),
            inArray(generationAssetLink.role, ['output', 'thumbnail'])
          )
        );

      return linkedAssets satisfies FeedLinkedAssetRecord[];
    },
  });
};
