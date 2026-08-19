import type { UploadFileResult } from './types';

const API_STORAGE_PRESIGN = '/api/storage/presign';
const API_STORAGE_COMPLETE = '/api/storage/complete';

type BrowserUploadOptions = {
  projectId?: string;
  bucketName?: string;
  fetch?: typeof fetch;
};

type DirectUploadResponse = {
  token: string;
  uploadUrl: string;
  method: 'PUT';
  headers?: Record<string, string>;
  key: string;
  url: string;
};

/**
 * Uploads a file from the browser to the storage provider
 * This function is meant to be used in client components
 *
 * @param file - The file object from an input element
 * @param folder - Optional folder path to store the file in
 * @returns Promise with the URL of the uploaded file
 */
export const uploadFileFromBrowser = async (
  file: File,
  folder?: string,
  options?: BrowserUploadOptions
): Promise<UploadFileResult> => {
  try {
    const fetchImpl = options?.fetch ?? fetch;
    const presignResponse = await fetchImpl(API_STORAGE_PRESIGN, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        folder: folder || '',
        bucket: options?.bucketName || '',
        projectId: options?.projectId || '',
      }),
    });

    if (!presignResponse.ok) {
      if (presignResponse.status === 413) {
        throw new Error('File size exceeds the server limit');
      }
      let errorMessage = 'Failed to upload file';
      try {
        const errorData = (await presignResponse.json()) as {
          error?: string;
          message?: string;
        };
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = 'Failed to upload file';
      }
      throw new Error(errorMessage);
    }

    const directUpload = (await presignResponse.json()) as DirectUploadResponse;

    const uploadResponse = await fetchImpl(directUpload.uploadUrl, {
      method: directUpload.method,
      headers: directUpload.headers,
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    const completeResponse = await fetchImpl(API_STORAGE_COMPLETE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        token: directUpload.token,
        projectId: options?.projectId || '',
      }),
    });
    if (!completeResponse.ok) {
      let errorMessage = 'Failed to finalize upload';
      try {
        const errorData = (await completeResponse.json()) as {
          error?: string;
          message?: string;
        };
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = 'Failed to finalize upload';
      }
      throw new Error(errorMessage);
    }

    return await completeResponse.json();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error occurred during file upload';
    throw new Error(message);
  }
};
