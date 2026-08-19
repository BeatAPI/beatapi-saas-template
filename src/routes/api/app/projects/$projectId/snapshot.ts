import { createFileRoute } from '@tanstack/react-router';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import {
  type ProjectSnapshotDocument,
  normalizeProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import {
  getProjectForUser,
  saveProjectSnapshot,
} from '@/core/projects/projects';
import {
  canUseLocalPreviewProject,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import {
  requireSession,
  unauthorizedResponse,
} from '@/core/workspace-lib/require-session';

type SaveProjectSnapshotRequest = {
  document?: ProjectSnapshotDocument;
  baseVersion?: number | null;
};

async function PUT({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (projectId === LOCAL_PREVIEW_PROJECT_ID && canUseLocalPreviewProject()) {
    let payload: SaveProjectSnapshotRequest | null = null;
    try {
      payload = (await request.json()) as SaveProjectSnapshotRequest;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload?.document) {
      return Response.json(
        { error: 'Snapshot document is required' },
        { status: 400 }
      );
    }

    return Response.json({
      projectId,
      version:
        typeof payload.baseVersion === 'number' ? payload.baseVersion + 1 : 1,
    });
  }

  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return unauthorizedResponse();
  }

  const currentProject = await getProjectForUser({
    userId: resolvedUser.userId,
    projectId,
  });
  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: SaveProjectSnapshotRequest | null = null;
  try {
    payload = (await request.json()) as SaveProjectSnapshotRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload?.document) {
    return Response.json(
      { error: 'Snapshot document is required' },
      { status: 400 }
    );
  }

  try {
    const result = await saveProjectSnapshot({
      userId: resolvedUser.userId,
      projectId,
      document: normalizeProjectSnapshotDocument(payload.document),
      baseVersion:
        typeof payload.baseVersion === 'number' ? payload.baseVersion : null,
    });

    return Response.json({
      projectId,
      version: result.version,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Unknown save failure';

    if (
      error instanceof Error &&
      error.name === 'ProjectSnapshotVersionConflict'
    ) {
      const snapshotConflict = error as Error & {
        currentVersion?: unknown;
      };
      const currentVersion =
        typeof snapshotConflict.currentVersion === 'number'
          ? snapshotConflict.currentVersion
          : undefined;

      return Response.json(
        {
          error: 'Project snapshot version conflict',
          detail,
          currentVersion,
        },
        { status: 409 }
      );
    }

    console.error('save project snapshot failed:', {
      projectId,
      userId: resolvedUser.userId,
      detail,
    });

    return Response.json(
      {
        error: 'Failed to save project snapshot',
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
      },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/app/projects/$projectId/snapshot')({
  server: {
    handlers: { PUT },
  },
});
