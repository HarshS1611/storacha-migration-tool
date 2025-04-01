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

export interface FileData {
  buffer: Buffer;
  fileName: string;
}

export interface S3ServiceConfig {
  bucketName: string;
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface UploadResponse {
  success: boolean;
  cid?: string;
  size?: number;
  status?: string;
  url?: string;
  error?: string;
}

export interface SpaceResponse {
  success: boolean;
  did?: string;
  name?: string;
  error?: string;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface MigrationProgress {
  status: 'preparing' | 'completed' | 'idle' | 'downloading' | 'uploading' | 'error';
  phase: 'preparing' | 'download' | 'upload' | 'completed' | 'failed';
  percentage: number;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  remainingFiles: number;
  currentFile?: string;
  currentBatch?: number;
  totalBatches?: number;
  startTime?: Date;
  endTime?: Date;
  elapsedTime: number;
  totalBytes: number;
  processedBytes: number;
  bytesUploaded: number;
  uploadedSize: string;
  downloadSpeed: number;
  uploadSpeed: number;
  estimatedTimeRemaining: string;
  downloadedBytes: number;
  totalDownloadBytes: number;
  uploadedBytes: number;
  totalUploadBytes: number;
  currentShardIndex?: number;
  totalShards?: number;
  errors: Array<{ file: string; error: Error }>;
  transferProgress?: TransferProgress;
  shardProgress?: ShardProgress;
}

export interface ProgressStatus {
  loaded: number;
  total: number;
  phase: 'download' | 'upload' | 'preparing';
  shardIndex?: number;
  totalShards?: number;
  currentFile?: string;
}

export interface StorachaMigratorEvents {
  onProgress: (progress: MigrationProgress) => void;
  onError: (error: Error, fileKey?: string) => void;
  onFileComplete: (fileKey: string, result: UploadResponse) => void;
}

export interface BatchConfig {
  concurrency: number;
  size: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

export interface StorachaConfig {
  email?: string;
  spaceName?: string;
  did?: string;
}

export interface ConnectionConfig {
  s3: S3ServiceConfig;
  storacha: StorachaConfig;
}

export interface MigrationResult {
  success: boolean;
  cid?: string;
  url?: string;
  size?: number;
  error?: string;
  failedFiles?: Array<{ file: string; error: Error }>;
  completedFiles?: number;
  totalFiles?: number;
}

export interface MigrationOptions {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  progressCallback?: (progress: MigrationProgress) => void;
  errorCallback?: (error: Error, fileKey?: string) => void;
}

export interface StorachaMigratorInterface {
  initialize(): Promise<void>;
  close(): Promise<void>;
  migrateFile(fileKey: string): Promise<UploadResponse>;
  migrateDirectory(directoryPath: string): Promise<UploadResponse>;
  createSpace(): Promise<SpaceResponse>;
  setSpace(did: string): Promise<SpaceResponse>;
  onProgress(callback: (progress: MigrationProgress) => void): void;
  onError(callback: (error: Error, fileKey?: string) => void): void;
}

export interface ShardProgress {
  shardIndex: number;
  totalShards: number;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
  currentShard?: number;
  shardSize?: number;
}

export interface TransferProgress {
  bytesTransferred: number;
  bytesTotal: number;
  percentage: number;
  speed: number;
  estimatedTimeRemaining: string;
  lastUpdate: number;
  lastDownloadBytes: number;
  lastUploadBytes: number;
  downloadBytes: number;
  uploadBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  data?: Partial<MigrationProgress> | {
    shardIndex: number;
    totalShards: number;
    percentage: number;
    size: string;
  } | {
    fileKey?: string;
    result?: any;
    error?: Error;
  };
}
