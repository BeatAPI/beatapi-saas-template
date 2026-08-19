
import { randomUUID } from 'crypto';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { project, projectCanvasState, userAsset } from '@/config/db/schema';
import {
  type ProjectSnapshotDocument,
  createEmptyProjectSnapshot,
  normalizeProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import {
  defaultWorkspaceMode,
  resolveWorkspaceMode,
  type WorkspaceMode,
} from '@/config/workspace-modes';

const DEFAULT_PROJECT_NAME = 'Untitled project';

const trimProjectName = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_PROJECT_NAME;
};

export const createProject = async ({
  userId,
  name,
  initialSnapshot,
  workspaceMode = defaultWorkspaceMode,
}: {
  userId: string;
  name?: string | null;
  initialSnapshot?: ProjectSnapshotDocument;
  workspaceMode?: WorkspaceMode;
}) => {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();
  const document = initialSnapshot ?? createEmptyProjectSnapshot();

  await db.insert(project).values({
    id,
    userId,
    name: trimProjectName(name),
    coverAssetId: null,
    status: 'active',
    currentStateVersion: 1,
    lastWorkspaceMode: resolveWorkspaceMode(workspaceMode),
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(projectCanvasState).values({
    projectId: id,
    documentJson: document,
    version: 1,
    updatedAt: now,
  });

  return {
    id,
    name: trimProjectName(name),
    snapshot: document,
  };
};

export const loadProjectsForUser = async ({
  userId,
  limit = 24,
}: {
  userId: string;
  limit?: number;
}) => {
  const db = await getDb();
  const projects = await db
    .select({
      ...getTableColumns(project),
      coverImageUrl: userAsset.publicUrl,
    })
    .from(project)
    .leftJoin(userAsset, eq(project.coverAssetId, userAsset.id))
    .where(and(eq(project.userId, userId), eq(project.status, 'active')))
    .orderBy(
      desc(project.lastOpenedAt),
      desc(project.updatedAt),
      desc(project.createdAt)
    )
    .limit(limit);

  return projects.map((entry: any) => ({
    ...entry,
    coverImageUrl: entry.coverImageUrl?.trim() || null,
  }));
};

export const getProjectForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
};

export const renameProject = async ({
  userId,
  projectId,
  name,
}: {
  userId: string;
  projectId: string;
  name: string;
}) => {
  const nextName = trimProjectName(name);
  const db = await getDb();
  await db
    .update(project)
    .set({
      name: nextName,
      updatedAt: new Date(),
    })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));

  return nextName;
};

export const markProjectOpened = async ({
  userId,
  projectId,
  workspaceMode,
}: {
  userId: string;
  projectId: string;
  workspaceMode?: WorkspaceMode;
}) => {
  const db = await getDb();
  const now = new Date();
  await db
    .update(project)
    .set({
      lastOpenedAt: now,
      ...(workspaceMode
        ? { lastWorkspaceMode: resolveWorkspaceMode(workspaceMode) }
        : {}),
    })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));
};

export const loadProjectWithLatestSnapshot = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) => {
  const db = await getDb();
  const currentProject = await getProjectForUser({ userId, projectId });
  if (!currentProject) {
    return null;
  }

  const snapshotRows = await db
    .select()
    .from(projectCanvasState)
    .where(eq(projectCanvasState.projectId, projectId))
    .limit(1);

  return {
    project: currentProject,
    snapshotVersion: snapshotRows[0]?.version ?? 1,
    snapshot: normalizeProjectSnapshotDocument(
      snapshotRows[0]?.documentJson ?? createEmptyProjectSnapshot()
    ),
  };
};

export const deleteProjects = async ({
  userId,
  projectIds,
}: {
  userId: string;
  projectIds: string[];
}) => {
  if (projectIds.length === 0) return;

  const db = await getDb();
  const now = new Date();

  for (const projectId of projectIds) {
    await db
      .update(project)
      .set({
        status: 'deleted',
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
  }
};

export const saveProjectSnapshot = async ({
  userId,
  projectId,
  document,
  baseVersion,
}: {
  userId: string;
  projectId: string;
  document: ProjectSnapshotDocument;
  baseVersion?: number | null;
}) => {
  const db = await getDb();
  const currentProject = await getProjectForUser({ userId, projectId });
  if (!currentProject) {
    throw new Error('Project not found');
  }

  const normalizedDocument = normalizeProjectSnapshotDocument(document);
  const stateRows = await db
    .select()
    .from(projectCanvasState)
    .where(eq(projectCanvasState.projectId, projectId))
    .limit(1);

  const currentState = stateRows[0] ?? null;
  const nextSerialized = JSON.stringify(normalizedDocument);
  const previousSerialized = currentState
    ? JSON.stringify(
        normalizeProjectSnapshotDocument(currentState.documentJson)
      )
    : null;

  if (
    typeof baseVersion === 'number' &&
    currentState &&
    currentState.version !== baseVersion &&
    previousSerialized !== nextSerialized
  ) {
    const error = new Error('Project snapshot version conflict') as Error & {
      currentVersion?: number;
    };
    error.name = 'ProjectSnapshotVersionConflict';
    error.currentVersion = currentState.version;
    throw error;
  }
  const nextVersion = (currentState?.version ?? 0) + 1;
  const now = new Date();

  if (previousSerialized !== nextSerialized) {
    await db
      .insert(projectCanvasState)
      .values({
        projectId,
        documentJson: normalizedDocument,
        version: nextVersion,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: projectCanvasState.projectId,
        set: {
          documentJson: normalizedDocument,
          version: nextVersion,
          updatedAt: now,
        },
      });

    await db
      .update(project)
      .set({
        currentStateVersion: nextVersion,
        updatedAt: now,
        lastOpenedAt: now,
      })
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
  } else {
    await db
      .update(project)
      .set({
        lastOpenedAt: now,
      })
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
  }

  return {
    version:
      previousSerialized === nextSerialized
        ? (currentState?.version ?? 1)
        : nextVersion,
  };
};
