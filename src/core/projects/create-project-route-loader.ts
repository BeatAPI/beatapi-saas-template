import { redirect } from '@tanstack/react-router';

import type { WorkspaceMode } from '@/config/workspace-modes';
import { buildLoginPath } from '@/core/workspace-lib/auth-redirect';
import {
  buildLocalizedCreateProjectPath,
  buildLocalizedProjectDetailPath,
  parseProjectEntryIntent,
} from '@/core/projects/project-entry';
import {
  canUseLocalPreviewProject,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import { getSession } from '@/core/workspace-lib/session';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { m } from '@/paraglide/messages.js';

export async function loadCreateProjectRoute(
  search: Record<string, string | undefined>,
  workspaceMode: WorkspaceMode
) {
  const locale = getLocale();
  const { target, model, prompt } = parseProjectEntryIntent(search);
  const resolvedPrompt = prompt?.trim() || undefined;
  const session = await getSession();

  if (!session?.user) {
    if (canUseLocalPreviewProject()) {
      throw redirect({
        to: buildLocalizedProjectDetailPath({
          locale,
          projectId: LOCAL_PREVIEW_PROJECT_ID,
          target,
          model,
          prompt,
          mode: workspaceMode,
        }) as never,
      });
    }

    const callbackUrl = buildLocalizedCreateProjectPath({
      locale,
      target,
      model,
      prompt,
      mode: workspaceMode,
    });
    throw redirect({
      to: buildLoginPath({ locale, callbackUrl }) as never,
    });
  }

  const messageLocale = locale.startsWith('zh') ? 'zh' : 'en';
  const projectName = resolvedPrompt
    ? resolvedPrompt.slice(0, 48)
    : m['BeatAPI.project.defaultName']({}, { locale: messageLocale });

  return {
    locale,
    target: target ?? null,
    model: model ?? null,
    prompt: prompt ?? null,
    workspaceMode,
    projectName,
  };
}
