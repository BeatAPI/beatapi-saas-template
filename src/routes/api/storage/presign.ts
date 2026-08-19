import { createFileRoute } from '@tanstack/react-router';
import {
  validateUploadedAudioFile,
  validateUploadedImageFile,
  validateUploadedVideoFile,
} from '@/core/effects/validation';
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
import { createDirectUploadDescriptor } from '@/core/workspace-storage/direct-upload';
import { StorageError } from '@/core/workspace-storage/types';

type DirectUploadRequest = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  folder?: string;
  bucket?: string;
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
    const body = (await request.json()) as DirectUploadRequest;
    const filename = body.filename?.trim();
    const contentType = body.contentType?.trim();
    const sizeBytes = body.sizeBytes;
    const requestedProjectId = body.projectId?.trim();
    const projectId =
      requestedProjectId === LOCAL_PREVIEW_PROJECT_ID &&
      canUseLocalPreviewProject()
        ? undefined
        : requestedProjectId;

    if (!filename || !contentType || !Number.isFinite(sizeBytes)) {
      return Response.json(
        { error: 'Missing upload file metadata' },
        { status: 400 }
      );
    }

    const normalizedSizeBytes = Number(sizeBytes);

    if (projectId) {
      const currentProject = await getProjectForUser({ userId, projectId });
      if (!currentProject) {
        return Response.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    const validation = contentType.startsWith('video/')
      ? validateUploadedVideoFile({
          size: normalizedSizeBytes,
          type: contentType,
        })
      : contentType.startsWith('audio/')
        ? validateUploadedAudioFile({
            size: normalizedSizeBytes,
            type: contentType,
          })
        : validateUploadedImageFile({
            size: normalizedSizeBytes,
            type: contentType,
          });

    if (!validation.ok) {
      return Response.json(
        {
          error:
            validation.code === 'IMAGE_TOO_LARGE' ||
            validation.code === 'VIDEO_TOO_LARGE' ||
            validation.code === 'AUDIO_TOO_LARGE'
              ? 'File size exceeds the server limit'
              : 'File type not supported',
        },
        { status: 400 }
      );
    }

    const descriptor = await createDirectUploadDescriptor({
      userId,
      filename,
      contentType,
      sizeBytes: normalizedSizeBytes,
      folder: body.folder,
      bucketName: body.bucket,
      projectId,
    });

    return Response.json(descriptor);
  } catch (error) {
    console.error('Error creating upload URL:', error);
    if (error instanceof StorageError || error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json(
      { error: 'Something went wrong while preparing the upload' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/storage/presign')({
  server: {
    handlers: { POST },
  },
});
