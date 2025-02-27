export interface FileData {
  buffer: Buffer;
  fileName: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export interface S3ServiceConfig {
  bucketName: string;
  region: string;
}

export interface StorachaServiceConfig {
  did?: string;
}

export interface SpaceResponse {
  success: boolean;
  did?: string;
  error?: string;
}
