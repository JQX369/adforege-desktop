export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

interface StorageUploadResult {
  url: string;
  providerId?: string;
}

export interface StoryStorageAdapter {
  uploadFromUrl(sourceUrl: string, targetKey: string, options?: UploadOptions): Promise<StorageUploadResult>;
  uploadBuffer(buffer: Buffer, targetKey: string, options?: UploadOptions): Promise<StorageUploadResult>;
}

class MockStorageAdapter implements StoryStorageAdapter {
  async uploadFromUrl(sourceUrl: string, targetKey: string): Promise<StorageUploadResult> {
    return {
      url: sourceUrl,
      providerId: targetKey
    };
  }

  async uploadBuffer(buffer: Buffer, targetKey: string, options?: UploadOptions): Promise<StorageUploadResult> {
    return {
      url: `https://mock-storage/${targetKey}`,
      providerId: targetKey
    };
  }
}

let storageAdapter: StoryStorageAdapter = new MockStorageAdapter();

export const setStoryStorageAdapter = (adapter: StoryStorageAdapter) => {
  storageAdapter = adapter;
};

export const getStoryStorageAdapter = () => storageAdapter;

