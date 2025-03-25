declare module 'storacha-migration-tool' {
  export interface MigrationProgress {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    currentFile?: string;
    percentage: number;
    errors: Array<{ file: string; error: Error }>;
    bytesUploaded: number;
    totalBytes: number;
    startTime: Date;
    estimatedTimeRemaining: string;
    formattedProgress: string;
    phase: 'download' | 'upload' | 'preparing';
    downloadProgress: number;
    uploadProgress: number;
    downloadSpeed: string;
    uploadSpeed: string;
    downloadBar: string;
    uploadBar: string;
    totalSize: string;
    uploadedSize: string;
    currentShardIndex?: number;
    totalShards?: number;
    downloadedBytes: number;
    uploadedBytes: number;
    totalDownloadBytes: number;
    totalUploadBytes: number;
  }

  export class StorachaMigrator {
    constructor(config: any);
    initialize(): Promise<void>;
    migrateDirectory(path: string): Promise<any>;
    onProgress(callback: (progress: MigrationProgress) => void): void;
    onError(callback: (error: Error, fileKey?: string) => void): void;
    close(): Promise<void>;
  }
}
