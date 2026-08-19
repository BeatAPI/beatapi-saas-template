import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFileRoute } from '@tanstack/react-router';
import { envConfigs } from '@/config';
import { md5 } from '@/lib/hash';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { uploadFile } from '@/core/workspace-storage';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { isSupportedRasterImage } from '@/lib/image-upload-validation';

const extFromMime = (mimeType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mimeType] || '';
};

// Cap for the no-R2 local-disk fallback (dev). Configurable via INLINE_IMAGE_MAX_KB.
const MAX_IMAGE_BYTES =
  (Number(envConfigs.inline_image_max_kb) || 10240) * 1024;
const MAX_IMAGE_FILES = 12;

const hasR2ImageStorageConfig = () =>
  Boolean(
    envConfigs.r2_endpoint &&
      envConfigs.r2_access_key_id &&
      envConfigs.r2_secret_access_key &&
      envConfigs.r2_image_bucket_name
  );

const missingR2ImageStorageConfig = () =>
  [
    ['R2_ENDPOINT', envConfigs.r2_endpoint],
    ['R2_ACCESS_KEY_ID', envConfigs.r2_access_key_id],
    ['R2_SECRET_ACCESS_KEY', envConfigs.r2_secret_access_key],
    ['R2_IMAGE_BUCKET_NAME', envConfigs.r2_image_bucket_name],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'upload-image',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized', 401);

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files.length) return respErr('No files provided');
    if (files.length > MAX_IMAGE_FILES) {
      return respErr(`Upload up to ${MAX_IMAGE_FILES} images at a time`);
    }

    const uploadResults: Array<{
      url: string;
      key: string;
      filename: string;
      deduped: boolean;
    }> = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);
      if (body.length > MAX_IMAGE_BYTES) {
        const limitKb = Math.round(MAX_IMAGE_BYTES / 1024);
        return respErr(
          `Image too large (${(body.length / 1024).toFixed(0)}KB > ${limitKb}KB)`
        );
      }
      if (!isSupportedRasterImage(file.type, body)) {
        return respErr(`File ${file.name} is not a supported raster image`);
      }

      const digest = md5(body);
      const ext = (extFromMime(file.type) || file.name.split('.').pop() || 'bin')
        .replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      const objectKey = `${digest}.${ext}`;

      if (!hasR2ImageStorageConfig()) {
        const missingR2Config = missingR2ImageStorageConfig();
        if (missingR2Config.length < 4) {
          return respErr(
            `R2 image storage is incomplete: ${missingR2Config.join(', ')}`
          );
        }

        // No R2_IMAGE_* storage configured → persist to public/uploads and
        // return a short local URL for development previews.
        const dir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, objectKey), body);
        uploadResults.push({
          url: `/uploads/${objectKey}`,
          key: `uploads/${objectKey}`,
          filename: file.name,
          deduped: false,
        });
        continue;
      }

      const result = await uploadFile(
        Buffer.from(body),
        objectKey,
        file.type,
        'uploads/images',
        {
          bucketName: envConfigs.r2_image_bucket_name,
          publicUrl: envConfigs.r2_image_public_url || undefined,
        }
      );

      uploadResults.push({
        url: result.url,
        key: result.key,
        filename: file.name,
        deduped: false,
      });
    }

    return respData({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } catch (e: any) {
    console.error('upload image failed:', e);
    return respErr('Upload image failed', 500);
  }
}

export const Route = createFileRoute('/api/storage/upload-image')({
  server: {
    handlers: { POST },
  },
});
