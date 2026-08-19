import assert from 'node:assert/strict';
import test from 'node:test';

import { envConfigs } from '@/config';
import { resolveUploadBucket } from './direct-upload';

const withR2Buckets = (run: () => void) => {
  const previous = {
    r2_image_bucket_name: envConfigs.r2_image_bucket_name,
    r2_image_public_url: envConfigs.r2_image_public_url,
    r2_video_bucket_name: envConfigs.r2_video_bucket_name,
    r2_video_public_url: envConfigs.r2_video_public_url,
  };

  envConfigs.r2_image_bucket_name = 'beatapi-prod-images';
  envConfigs.r2_image_public_url = 'https://images.example.com';
  envConfigs.r2_video_bucket_name = 'beatapi-prod-videos';
  envConfigs.r2_video_public_url = 'https://videos.example.com';

  try {
    run();
  } finally {
    Object.assign(envConfigs, previous);
  }
};

test('infers upload bucket from MIME type when the client omits bucket', () => {
  withR2Buckets(() => {
    assert.deepEqual(resolveUploadBucket(undefined, 'image/png'), {
      bucketName: 'beatapi-prod-images',
      publicUrl: 'https://images.example.com',
    });
    assert.deepEqual(resolveUploadBucket(undefined, 'video/mp4'), {
      bucketName: 'beatapi-prod-videos',
      publicUrl: 'https://videos.example.com',
    });
  });
});

test('rejects business asset aliases that are not real configured bucket names', () => {
  withR2Buckets(() => {
    assert.throws(
      () => resolveUploadBucket('image', 'image/png'),
      /Requested upload bucket is not allowed/
    );
  });
});
