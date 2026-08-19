export type PersistedGeneratedWorkspaceStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export type PersistedGeneratedWorkspaceAssetType = 'image' | 'video';

type PersistedAssetLink = {
  publicUrl: string | null;
} | null;

export const resolvePersistedGeneratedMedia = ({
  status,
  assetType,
  linkedOutput,
}: {
  status: PersistedGeneratedWorkspaceStatus;
  assetType: PersistedGeneratedWorkspaceAssetType;
  linkedOutput: PersistedAssetLink;
}) => {
  if (status !== 'succeeded') {
    return null;
  }

  if (!linkedOutput?.publicUrl) {
    return null;
  }

  if (assetType === 'video') {
    return {
      mediaUrl: linkedOutput.publicUrl,
      videoUrl: linkedOutput.publicUrl,
    };
  }

  return {
    mediaUrl: linkedOutput.publicUrl,
    videoUrl: null,
  };
};
