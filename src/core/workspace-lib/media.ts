const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mov'];
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif'];

const getNormalizedMediaUrl = (url?: string) =>
  url?.split(/[?#]/, 1)[0].toLowerCase() ?? '';

export const getMediaKind = (url?: string): 'video' | 'image' | 'unknown' => {
  const normalizedUrl = getNormalizedMediaUrl(url);

  if (!normalizedUrl) {
    return 'unknown';
  }

  if (VIDEO_EXTENSIONS.some((extension) => normalizedUrl.endsWith(extension))) {
    return 'video';
  }

  if (IMAGE_EXTENSIONS.some((extension) => normalizedUrl.endsWith(extension))) {
    return 'image';
  }

  return 'unknown';
};

export const isVideoMediaUrl = (url?: string) => getMediaKind(url) === 'video';

export const isImageMediaUrl = (url?: string) => getMediaKind(url) === 'image';
