import { createFileRoute } from '@tanstack/react-router';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import {
  resolveWorkspaceMode,
  type WorkspaceMode,
} from '@/config/workspace-modes';
import {
  getProjectForUser,
  markProjectOpened,
  renameProject,
} from '@/core/projects/projects';
import {
  canUseLocalPreviewProject,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import {
  requireSession,
  unauthorizedResponse,
} from '@/core/workspace-lib/require-session';

type UpdateProjectRequest = {
  name?: string;
  workspaceMode?: string;
};

type OpenProjectRequest = {
  workspaceMode?: string;
};

async function POST({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const { projectId } = params;
  let payload: OpenProjectRequest = {};
  try {
    payload = (await request.json()) as OpenProjectRequest;
  } catch {
    payload = {};
  }
  const workspaceMode: WorkspaceMode | undefined = payload.workspaceMode
    ? resolveWorkspaceMode(payload.workspaceMode)
    : undefined;
  if (projectId === LOCAL_PREVIEW_PROJECT_ID && canUseLocalPreviewProject()) {
    return Response.json({
      id: projectId,
      lastOpenedAt: new Date().toISOString(),
      workspaceMode,
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

  await markProjectOpened({
    userId: resolvedUser.userId,
    projectId,
    workspaceMode,
  });

  return Response.json({
    id: projectId,
    lastOpenedAt: new Date().toISOString(),
    workspaceMode,
  });
}

async function PATCH({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (projectId === LOCAL_PREVIEW_PROJECT_ID && canUseLocalPreviewProject()) {
    let payload: UpdateProjectRequest | null = null;
    try {
      payload = (await request.json()) as UpdateProjectRequest;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    return Response.json({
      id: projectId,
      name: payload?.name?.trim() || 'Local preview canvas',
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

  let payload: UpdateProjectRequest | null = null;
  try {
    payload = (await request.json()) as UpdateProjectRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const nextName = payload?.name?.trim();
  if (!nextName) {
    return Response.json(
      { error: 'Project name is required' },
      { status: 400 }
    );
  }

  const name = await renameProject({
    userId: resolvedUser.userId,
    projectId,
    name: nextName,
  });

  return Response.json({ id: projectId, name });
}

export const Route = createFileRoute('/api/app/projects/$projectId')({
  server: {
    handlers: { POST, PATCH },
  },
});
