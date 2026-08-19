import { createFileRoute } from '@tanstack/react-router';
import {
  linkProjectAsset,
  recordUserAsset,
} from '@/core/workspace-lib/assets/user-assets';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { getProjectForUser } from '@/core/projects/projects';
import {
  canUseLocalPreviewProject,
  LOCAL_PREVIEW_PROJECT_ID,
} from '@/core/projects/local-preview-project';
import {
  requireSession,
  unauthorizedResponse,
} from '@/core/workspace-lib/require-session';
import { objectExists } from '@/core/workspace-storage';
import {
  inferAssetTypeFromMime,
  verifyUploadToken,
} from '@/core/workspace-storage/direct-upload';

type CompleteUploadRequest = {
  token?: string;
  projectId?: string;
};

async function POST({ request }: { request: Request }) {
  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return unauthorizedResponse();
  }
  const { userId } = resolvedUser;

  try {
    const body = (await request.json()) as CompleteUploadRequest;
    if (!body.token) {
      return Response.json(
        { error: 'Missing upload token' },
        { status: 400 }
      );
    }

    const upload = verifyUploadToken({
      token: body.token,
      userId,
    });

    const requestedProjectId =
      body.projectId?.trim() || upload.metadata.projectId || null;
    const projectId =
      requestedProjectId === LOCAL_PREVIEW_PROJECT_ID &&
      canUseLocalPreviewProject()
        ? null
        : requestedProjectId;
    if (projectId) {
      const currentProject = await getProjectForUser({ userId, projectId });
      if (!currentProject) {
        return Response.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    const uploadedObjectExists = await objectExists(upload.key, {
      bucketName: upload.bucket,
    });
    if (!uploadedObjectExists) {
      return Response.json(
        { error: 'Uploaded object not found' },
        { status: 400 }
      );
    }

    const assetId = await recordUserAsset({
      userId,
      type: inferAssetTypeFromMime(upload.mimeType),
      source: 'upload',
      assetClass: 'original',
      storageProvider: 'r2',
      bucket: upload.bucket,
      objectKey: upload.key,
      publicUrl: upload.url,
      filename: upload.metadata.originalFilename,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      originProjectId: projectId,
      metadata: upload.metadata,
    });

    if (projectId) {
      await linkProjectAsset({
        projectId,
        assetId,
        role: 'upload',
      });
    }

    return Response.json({
      key: upload.key,
      url: upload.url,
      assetId,
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while completing the upload';
    return Response.json({ error: message }, { status: 400 });
  }
}

export const Route = createFileRoute('/api/storage/complete')({
  server: {
    handlers: { POST },
  },
});
