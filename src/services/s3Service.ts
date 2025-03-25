import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { FileData, S3ServiceConfig } from "../types/index.js";
import { EventManager } from "../managers/EventManager.js";

export class S3Service {
  private readonly client: S3Client;
  private readonly config: S3ServiceConfig;
  private eventManager?: EventManager;

  constructor(config: S3ServiceConfig, eventManager?: EventManager) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      credentials: config.credentials ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    });
    this.eventManager = eventManager;
  }

  /**
   * Fetches a file from S3 as a buffer
   * @param {string} fileKey - The file key in S3
   * @returns {Promise<FileData>}
   */
  async fetchFileFromS3(fileKey: string): Promise<FileData> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: fileKey,
    });

    const response = await this.client.send(command);
    const chunks: Uint8Array[] = [];
    const totalBytes = Number(response.ContentLength) || 0;
    let bytesReceived = 0;

    if (!response.Body) {
      throw new Error(`No body in response for file: ${fileKey}`);
    }

    // Mark the start of download phase
    this.eventManager?.updateProgress({ phase: 'download' });

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
      bytesReceived += chunk.length;
      this.eventManager?.updateFileProgress(
        fileKey,
        bytesReceived,
        totalBytes,
        'download'
      );
    }

    const buffer = Buffer.concat(chunks);
    return {
      buffer,
      fileName: fileKey.split("/").pop() || fileKey,
    };
  }

  /**
   * Lists all files in an S3 directory (prefix)
   * @param {string} directoryPath - The S3 directory (prefix)
   * @returns {Promise<string[]>} - Array of file keys
   */
  async listFilesInS3Directory(directoryPath: string): Promise<string[]> {
    try {
      console.log(`Listing files in S3 directory: ${directoryPath}`);
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: directoryPath,
      });

      const data = await this.client.send(command);
      return data.Contents
        ? data.Contents.map((item) => item.Key as string)
        : [];
    } catch (error) {
      console.error("Error listing files in S3 directory:", error);
      throw error;
    }
  }

  /**
   * Fetches multiple files in batches
   * @param {string[]} fileKeys - Array of file keys to fetch
   * @returns {Promise<FileData[]>}
   */
  async fetchFilesInBatches(fileKeys: string[]): Promise<FileData[]> {
    const batchSize = 5;
    const results: FileData[] = [];
    
    // Calculate total size first
    let totalDownloadBytes = 0;
    for (const key of fileKeys) {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);
      totalDownloadBytes += Number(response.ContentLength) || 0;
    }
    
    // Set initial total bytes for download phase
    this.eventManager?.setTotalBytes(totalDownloadBytes, totalDownloadBytes);
    
    for (let i = 0; i < fileKeys.length; i += batchSize) {
      const batch = fileKeys.slice(i, i + batchSize);
      this.eventManager?.updateProgress({
        phase: 'download',
        currentFile: `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fileKeys.length / batchSize)}`
      });
      
      const batchResults = await Promise.all(
        batch.map(key => this.fetchFileFromS3(key))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}
