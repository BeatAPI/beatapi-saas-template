import { createFileRoute } from '@tanstack/react-router';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { serializeProjectCenterCard } from '@/core/projects/project-entry';
import {
  createProject,
  deleteProjects,
  loadProjectsForUser,
} from '@/core/projects/projects';
import {
  canUseLocalPreviewProject,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import {
  requireSession,
  unauthorizedResponse,
} from '@/core/workspace-lib/require-session';
import {
  canUseDevApiFallback,
  logDevApiFallback,
} from '@/core/workspace-lib/dev-api-fallback';
import { resolveWorkspaceMode } from '@/config/workspace-modes';

type DeleteProjectsRequest = {
  projectIds?: unknown;
};

type CreateProjectRequest = {
  name?: unknown;
  workspaceMode?: unknown;
};

const readProjectIds = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

async function resolveUser(request: Request) {
  const session = await requireSession(request);
  return resolveRequestUser(request, session?.user.id);
}

async function GET({ request }: { request: Request }) {
  let resolvedUser: Awaited<ReturnType<typeof resolveUser>>;
  try {
    resolvedUser = await resolveUser(request);
    if (!resolvedUser) {
      return unauthorizedResponse();
    }
  } catch (error) {
    if (canUseDevApiFallback(request)) {
      logDevApiFallback('/api/app/projects', error);
      return Response.json({ projects: [] });
    }
    throw error;
  }

  try {
    const projects = await loadProjectsForUser({ userId: resolvedUser.userId });

    return Response.json({
      projects: projects.map(serializeProjectCenterCard),
    });
  } catch (error) {
    if (canUseDevApiFallback(request)) {
      logDevApiFallback('/api/app/projects', error);
      return Response.json({ projects: [] });
    }
    throw error;
  }
}

async function POST({ request }: { request: Request }) {
  let resolvedUser: Awaited<ReturnType<typeof resolveUser>>;
  try {
    resolvedUser = await resolveUser(request);
    if (!resolvedUser) {
      return unauthorizedResponse();
    }
  } catch (error) {
    if (canUseDevApiFallback(request) && canUseLocalPreviewProject()) {
      logDevApiFallback('/api/app/projects', error);
      return Response.json({
        id: LOCAL_PREVIEW_PROJECT_ID,
        name: 'Local preview canvas',
        isLocalPreview: true,
      });
    }
    throw error;
  }

  let payload: CreateProjectRequest | null = null;
  try {
    payload = (await request.json()) as CreateProjectRequest;
  } catch {
    payload = {};
  }

  const name =
    typeof payload?.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : null;

  try {
    const nextProject = await createProject({
      userId: resolvedUser.userId,
      name,
      workspaceMode: resolveWorkspaceMode(
        typeof payload?.workspaceMode === 'string'
          ? payload.workspaceMode
          : undefined
      ),
    });

    return Response.json({
      id: nextProject.id,
      name: nextProject.name,
    });
  } catch (error) {
    if (canUseDevApiFallback(request) && canUseLocalPreviewProject()) {
      logDevApiFallback('/api/app/projects', error);
      return Response.json({
        id: LOCAL_PREVIEW_PROJECT_ID,
        name: 'Local preview canvas',
        isLocalPreview: true,
      });
    }
    throw error;
  }
}

async function DELETE({ request }: { request: Request }) {
  const resolvedUser = await resolveUser(request);
  if (!resolvedUser) {
    return unauthorizedResponse();
  }

  let payload: DeleteProjectsRequest | null = null;
  try {
    payload = (await request.json()) as DeleteProjectsRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectIds = readProjectIds(payload?.projectIds);
  if (projectIds.length === 0) {
    return Response.json(
      { error: 'projectIds is required' },
      { status: 400 }
    );
  }

  await deleteProjects({ userId: resolvedUser.userId, projectIds });
  return Response.json({ success: true });
}

export const Route = createFileRoute('/api/app/projects/')({
  server: {
    handlers: { GET, POST, DELETE },
  },
});
