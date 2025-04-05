declare module 'storacha-migration-tool' {
  export interface StorachaMigratorConfig {
    s3: {
      bucketName: string;
      region: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    };
    storacha: {
      email?: string;
    };
    retry: {
      maxAttempts: number;
      backoffMs: number;
      maxBackoffMs: number;
    };
    batch: {
      concurrency: number;
      size: number;
    };
  }

  export interface TransferProgress {
    bytesTransferred: number;
    bytesTotal: number;
    percentage: number;
    speed: string;
    estimatedTimeRemaining: string;
  }

  export interface ShardProgress {
    shardIndex: number;
    totalShards: number;
    bytesUploaded: number;
    bytesTotal: number;
    percentage: number;
  }

  export interface MigrationProgress {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    percentage: number;
    errors: Array<{ file: string; error: Error }>;
    currentFile?: string;
    bytesUploaded: number;
    totalBytes: number;
    startTime: Date;
    endTime?: Date;
    estimatedTimeRemaining: string;
    phase: 'download' | 'upload' | 'preparing';
    status: 'idle' | 'preparing' | 'downloading' | 'uploading' | 'completed' | 'failed';
    downloadProgress: number;
    uploadProgress: number;
    downloadSpeed: string;
    uploadSpeed: string;
    formattedProgress: string;
    downloadBar: string;
    uploadBar: string;
    totalSize: string;
    uploadedSize: string;
    downloadedBytes: number;
    uploadedBytes: number;
    totalDownloadBytes: number;
    totalUploadBytes: number;
    elapsedTime: string;
    remainingFiles: number;
    currentBatch?: number;
    totalBatches?: number;
    retryCount: number;
    maxRetries: number;
    currentShardIndex?: number;
    totalShards?: number;
    transferProgress?: TransferProgress;
    shardProgress?: ShardProgress;
    shardIndex?: string;
  }

  export interface UploadResponse {
    success: boolean;
    cid?: string;
    size?: number;
    status?: string;
    url?: string;
    error?: string;
  }

  export class StorachaMigrator {
    constructor(config: StorachaMigratorConfig);
    initialize(): Promise<void>;
    close(): Promise<void>;
    migrateFile(fileKey: string): Promise<UploadResponse>;
    migrateDirectory(directoryPath: string): Promise<UploadResponse>;
    listSpaces(): Promise<string[]>;
    listFilesInSpace(): Promise<string[]>;
    onProgress(callback: (progress: MigrationProgress) => void): void;
    onError(callback: (error: Error, fileKey?: string) => void): void;
  }
}
