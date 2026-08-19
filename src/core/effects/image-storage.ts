import { envConfigs } from '@/config';
import { linkGenerationAsset, recordUserAsset } from '@/core/workspace-lib/assets/user-assets';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { uploadFile } from '@/core/workspace-storage';

const pickImageSourceUrl = (output: unknown) => {
  const media = resolveOutputMedia(output);
  return media.imageUrls[0] ?? media.resultUrls[0] ?? media.resultUrl;
};

const extensionByType = (contentType: string) => {
  if (contentType.includes('image/png')) return 'png';
  if (contentType.includes('image/webp')) return 'webp';
  if (contentType.includes('image/gif')) return 'gif';
  if (contentType.includes('image/jpeg')) return 'jpg';
  return 'jpg';
};

export const persistImageOutputIfNeeded = async ({
  output,
  wmTaskId,
  effectId,
  userId,
}: {
  output: unknown;
  wmTaskId: string;
  effectId: number;
  userId?: string;
}) => {
  if (!output || typeof output !== 'object') {
    return output;
  }

  const outputObject = output as Record<string, unknown>;
  const sourceUrl = pickImageSourceUrl(outputObject);
  if (!sourceUrl) return outputObject;
  if (
    typeof outputObject.stored_result_url === 'string' &&
    outputObject.stored_result_url === sourceUrl
  ) {
    return outputObject;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return {
        ...outputObject,
        provider_result_url: sourceUrl,
        storage_sync_failed: true,
      };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = extensionByType(contentType);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imageBucketName = envConfigs.r2_image_bucket_name || undefined;
    const imagePublicUrl = envConfigs.r2_image_public_url || undefined;
    const uploadResult = await uploadFile(
      imageBuffer,
      `${wmTaskId}.${extension}`,
      contentType,
      `effects/${effectId}/images`,
      {
        bucketName: imageBucketName,
        publicUrl: imagePublicUrl,
      }
    );

    if (userId && imageBucketName) {
      const assetId = await recordUserAsset({
        userId,
        type: 'image',
        source: 'provider',
        assetClass: 'generated',
        storageProvider: 'r2',
        bucket: imageBucketName,
        objectKey: uploadResult.key,
        publicUrl: uploadResult.url,
        filename: `${wmTaskId}.${extension}`,
        mimeType: contentType,
        sizeBytes: imageBuffer.byteLength,
        metadata: {
          providerResultUrl: sourceUrl,
          effectId,
          wmTaskId,
        },
      });
      await linkGenerationAsset({
        generationId: wmTaskId,
        assetId,
        role: 'output',
      });
    }

    const existingImageUrls = Array.isArray(outputObject.image_urls)
      ? outputObject.image_urls
      : [];
    const normalizedImageUrls = existingImageUrls
      .filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      )
      .filter((item) => item !== sourceUrl);

    return {
      ...outputObject,
      provider_result_url: sourceUrl,
      stored_result_url: uploadResult.url,
      stored_image_key: uploadResult.key,
      image_urls: [uploadResult.url, ...normalizedImageUrls],
      result_url: uploadResult.url,
      storage_sync_failed: false,
    };
  } catch (error) {
    console.error('persistImageOutputIfNeeded error:', error);
    return {
      ...outputObject,
      provider_result_url: sourceUrl,
      storage_sync_failed: true,
    };
  }
};
