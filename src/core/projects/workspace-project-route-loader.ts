import { notFound, redirect } from '@tanstack/react-router';

import type { WorkspaceMode } from '@/config/workspace-modes';
import { buildLoginPath } from '@/core/workspace-lib/auth-redirect';
import {
  buildLocalizedProjectDetailPath,
  parseProjectEntryIntent,
} from '@/core/projects/project-entry';
import {
  canUseLocalPreviewProject,
  createLocalPreviewProjectState,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import { loadProjectWithLatestSnapshotFn } from '@/core/projects/server-functions';
import { getSession } from '@/core/workspace-lib/session';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { m } from '@/paraglide/messages.js';

export async function loadWorkspaceProjectRoute({
  projectId,
  search,
  workspaceMode,
}: {
  projectId: string;
  search: Record<string, string | undefined>;
  workspaceMode: WorkspaceMode;
}) {
  const locale = getLocale();
  const messageLocale = locale.startsWith('zh') ? 'zh' : 'en';
  const { target, model, prompt } = parseProjectEntryIntent(search);
  const isLocalPreviewProject =
    projectId === LOCAL_PREVIEW_PROJECT_ID && canUseLocalPreviewProject();
  const session = isLocalPreviewProject ? null : await getSession();

  if (!session?.user) {
    if (isLocalPreviewProject) {
      const projectState = createLocalPreviewProjectState(locale, {
        previewMode: search.preview,
      });
      return {
        locale,
        currentUser: {
          id: 'local-preview-user',
          name: m['BeatAPI.project.localPreviewUser'](
            {},
            { locale: messageLocale }
          ),
          email: 'local-preview@beat-ai.local',
        },
        project: projectState.project,
        snapshot: projectState.snapshot,
        snapshotVersion: projectState.snapshotVersion,
        target: target ?? null,
        modelId: model ?? null,
        prompt: prompt ?? null,
        projectPath: buildLocalizedProjectDetailPath({
          locale,
          projectId: projectState.project.id,
          mode: workspaceMode,
        }),
        workspaceMode,
      };
    }

    const callbackUrl = buildLocalizedProjectDetailPath({
      locale,
      projectId,
      target,
      model,
      prompt,
      mode: workspaceMode,
    });
    throw redirect({
      to: buildLoginPath({ locale, callbackUrl }) as never,
    });
  }

  const projectState = await loadProjectWithLatestSnapshotFn({
    data: {
      userId: session.user.id,
      projectId,
    },
  });

  if (!projectState) throw notFound();

  return {
    locale,
    currentUser: session.user,
    project: projectState.project,
    snapshot: projectState.snapshot,
    snapshotVersion: projectState.snapshotVersion,
    target: target ?? null,
    modelId: model ?? null,
    prompt: prompt ?? null,
    projectPath: buildLocalizedProjectDetailPath({
      locale,
      projectId: projectState.project.id,
      mode: workspaceMode,
    }),
    workspaceMode,
  };
}
