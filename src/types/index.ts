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
  formattedProgress?: string;
  uploadSpeed?: string;
  totalSize?: string;
  uploadedSize?: string;
}
