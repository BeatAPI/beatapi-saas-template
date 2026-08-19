import { envConfigs } from '@/config';
import { linkGenerationAsset, recordUserAsset } from '@/core/workspace-lib/assets/user-assets';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { uploadFile } from '@/core/workspace-storage';

const pickVideoSourceUrl = (output: unknown) => {
  const media = resolveOutputMedia(output);
  return media.resultUrl ?? media.videoUrls[0] ?? media.resultUrls[0];
};

const pickCoverSourceUrl = (output: unknown) => {
  const media = resolveOutputMedia(output);
  return media.providerCoverUrl ?? media.coverUrls[0] ?? media.coverUrl;
};

const videoExtensionByType = (contentType: string) => {
  if (contentType.includes('video/mp4')) return 'mp4';
  if (contentType.includes('video/webm')) return 'webm';
  return 'mp4';
};

const imageExtensionByType = (contentType: string) => {
  if (contentType.includes('image/png')) return 'png';
  if (contentType.includes('image/webp')) return 'webp';
  if (contentType.includes('image/gif')) return 'gif';
  if (contentType.includes('image/jpeg')) return 'jpg';
  return 'jpg';
};

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      )
    : [];

export const persistVideoOutputIfNeeded = async ({
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
  const sourceUrl = pickVideoSourceUrl(outputObject);
  let persistedOutput = outputObject;

  try {
    if (
      sourceUrl &&
      !(
        typeof outputObject.stored_result_url === 'string' &&
        outputObject.stored_result_url === sourceUrl
      )
    ) {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return {
          ...outputObject,
          provider_result_url: sourceUrl,
          storage_sync_failed: true,
        };
      }

      const contentType = response.headers.get('content-type') || 'video/mp4';
      const extension = videoExtensionByType(contentType);
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const videoBucketName = envConfigs.r2_video_bucket_name || undefined;
      const videoPublicUrl = envConfigs.r2_video_public_url || undefined;
      const uploadResult = await uploadFile(
        videoBuffer,
        `${wmTaskId}.${extension}`,
        contentType,
        `effects/${effectId}/videos`,
        {
          bucketName: videoBucketName,
          publicUrl: videoPublicUrl,
        }
      );
      if (userId && videoBucketName) {
        const assetId = await recordUserAsset({
          userId,
          type: 'video',
          source: 'provider',
          assetClass: 'generated',
          storageProvider: 'r2',
          bucket: videoBucketName,
          objectKey: uploadResult.key,
          publicUrl: uploadResult.url,
          filename: `${wmTaskId}.${extension}`,
          mimeType: contentType,
          sizeBytes: videoBuffer.byteLength,
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

      const existingVideoUrls = readStringArray(outputObject.video_urls).filter(
        (item) => item !== sourceUrl && item !== uploadResult.url
      );
      const existingResultUrls = readStringArray(
        outputObject.result_urls
      ).filter((item) => item !== sourceUrl && item !== uploadResult.url);

      persistedOutput = {
        ...persistedOutput,
        provider_result_url: sourceUrl,
        stored_result_url: uploadResult.url,
        stored_video_key: uploadResult.key,
        video_urls: [uploadResult.url, ...existingVideoUrls],
        result_urls: [uploadResult.url, ...existingResultUrls],
        result_url: uploadResult.url,
        storage_sync_failed: false,
      };
    }

    const coverSourceUrl = pickCoverSourceUrl(persistedOutput);
    if (
      coverSourceUrl &&
      !(
        typeof persistedOutput.stored_cover_url === 'string' &&
        persistedOutput.stored_cover_url === coverSourceUrl
      )
    ) {
      const coverResponse = await fetch(coverSourceUrl);
      if (!coverResponse.ok) {
        return {
          ...persistedOutput,
          provider_cover_url: coverSourceUrl,
          storage_sync_failed: true,
        };
      }

      const coverContentType =
        coverResponse.headers.get('content-type') || 'image/jpeg';
      const coverExtension = imageExtensionByType(coverContentType);
      const coverBuffer = Buffer.from(await coverResponse.arrayBuffer());
      const imageBucketName = envConfigs.r2_image_bucket_name || undefined;
      const imagePublicUrl = envConfigs.r2_image_public_url || undefined;
      const coverUploadResult = await uploadFile(
        coverBuffer,
        `${wmTaskId}-cover.${coverExtension}`,
        coverContentType,
        `effects/${effectId}/covers`,
        {
          bucketName: imageBucketName,
          publicUrl: imagePublicUrl,
        }
      );
      if (userId && imageBucketName) {
        const coverAssetId = await recordUserAsset({
          userId,
          type: 'image',
          source: 'provider',
          assetClass: 'generated',
          storageProvider: 'r2',
          bucket: imageBucketName,
          objectKey: coverUploadResult.key,
          publicUrl: coverUploadResult.url,
          filename: `${wmTaskId}-cover.${coverExtension}`,
          mimeType: coverContentType,
          sizeBytes: coverBuffer.byteLength,
          metadata: {
            providerCoverUrl: coverSourceUrl,
            effectId,
            wmTaskId,
          },
        });
        await linkGenerationAsset({
          generationId: wmTaskId,
          assetId: coverAssetId,
          role: 'thumbnail',
        });
      }

      const existingCoverUrls = readStringArray(
        persistedOutput.cover_urls
      ).filter(
        (item) => item !== coverSourceUrl && item !== coverUploadResult.url
      );

      persistedOutput = {
        ...persistedOutput,
        provider_cover_url: coverSourceUrl,
        stored_cover_url: coverUploadResult.url,
        stored_cover_key: coverUploadResult.key,
        cover_urls: [coverUploadResult.url, ...existingCoverUrls],
        cover_url: coverUploadResult.url,
        storage_sync_failed: false,
      };
    }

    if (!sourceUrl) {
      return persistedOutput;
    }

    return {
      ...persistedOutput,
      storage_sync_failed: persistedOutput.storage_sync_failed === true,
    };
  } catch (error) {
    console.error('persistVideoOutputIfNeeded error:', error);
    return {
      ...persistedOutput,
      ...(sourceUrl ? { provider_result_url: sourceUrl } : {}),
      storage_sync_failed: true,
    };
  }
};
