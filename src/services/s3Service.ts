import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { FileData, S3ServiceConfig } from "../types/index.js";

export class S3Service {
  private readonly client: S3Client;
  private readonly config: S3ServiceConfig;

  constructor(config: S3ServiceConfig) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      credentials: config.credentials ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    });
  }

  /**
   * Fetches a file from S3 as a buffer
   * @param {string} fileKey - The file key in S3
   * @returns {Promise<FileData>}
   */
  async fetchFileFromS3(fileKey: string): Promise<FileData> {
    try {
      console.log(
        `Fetching file: ${fileKey} from S3 bucket: ${this.config.bucketName}`
      );
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: fileKey,
      });
      const data = await this.client.send(command);

      if (!data.Body) {
        throw new Error("No data received from S3");
      }

      const body = await data.Body.transformToByteArray();
      return { buffer: Buffer.from(body), fileName: fileKey };
    } catch (error) {
      console.error("Error fetching file from S3:", error);
      throw error;
    }
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
    try {
      return await Promise.all(
        fileKeys.map((fileKey) => this.fetchFileFromS3(fileKey))
      );
    } catch (error) {
      console.error("Error fetching files in batches:", error);
      throw error;
    }
  }
}
