import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { projectAssetMembership, userAsset } from '@/config/db/schema';
import { getProjectForUser } from '@/core/projects/projects';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import {
  requireSession,
  unauthorizedResponse,
} from '@/core/workspace-lib/require-session';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  canUseDevApiFallback,
  logDevApiFallback,
} from '@/core/workspace-lib/dev-api-fallback';

async function GET({ request }: { request: Request }) {
  let resolvedUser: Awaited<ReturnType<typeof resolveRequestUser>>;
  try {
    const session = await requireSession(request);
    resolvedUser = await resolveRequestUser(request, session?.user.id);
    if (!resolvedUser) {
      return unauthorizedResponse();
    }
  } catch (error) {
    if (canUseDevApiFallback(request)) {
      logDevApiFallback('/api/app/recent-assets', error);
      return Response.json({ images: [], videos: [] });
    }
    throw error;
  }

  try {
    const db = await getDb();
    const projectId =
      new URL(request.url).searchParams.get('projectId')?.trim() || null;

    if (projectId) {
      const currentProject = await getProjectForUser({
        userId: resolvedUser.userId,
        projectId,
      });
      if (!currentProject) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const imageFields = {
      id: userAsset.id,
      publicUrl: userAsset.publicUrl,
      filename: userAsset.filename,
      width: userAsset.width,
      height: userAsset.height,
      createdAt: userAsset.createdAt,
    };
    const videoFields = {
      ...imageFields,
      durationMs: userAsset.durationMs,
    };

    const imageQuery = projectId
      ? db
          .selectDistinct(imageFields)
          .from(userAsset)
          .innerJoin(
            projectAssetMembership,
            eq(projectAssetMembership.assetId, userAsset.id)
          )
          .where(
            and(
              eq(userAsset.userId, resolvedUser.userId),
              eq(projectAssetMembership.projectId, projectId),
              eq(userAsset.type, 'image'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30)
      : db
          .select(imageFields)
          .from(userAsset)
          .where(
            and(
              eq(userAsset.userId, resolvedUser.userId),
              eq(userAsset.type, 'image'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30);

    const videoQuery = projectId
      ? db
          .selectDistinct(videoFields)
          .from(userAsset)
          .innerJoin(
            projectAssetMembership,
            eq(projectAssetMembership.assetId, userAsset.id)
          )
          .where(
            and(
              eq(userAsset.userId, resolvedUser.userId),
              eq(projectAssetMembership.projectId, projectId),
              eq(userAsset.type, 'video'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30)
      : db
          .select(videoFields)
          .from(userAsset)
          .where(
            and(
              eq(userAsset.userId, resolvedUser.userId),
              eq(userAsset.type, 'video'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30);

    const [images, videos] = await Promise.all([imageQuery, videoQuery]);

    return Response.json({ images, videos });
  } catch (error) {
    if (canUseDevApiFallback(request)) {
      logDevApiFallback('/api/app/recent-assets', error);
      return Response.json({ images: [], videos: [] });
    }
    throw error;
  }
}

export const Route = createFileRoute('/api/app/recent-assets')({
  server: {
    handlers: { GET },
  },
});
