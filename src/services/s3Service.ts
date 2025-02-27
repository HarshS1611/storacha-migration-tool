import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { FileData, S3ServiceConfig } from "../types/index.js";
import dotenv from "dotenv";
dotenv.config();

// Initialize AWS S3 Client
const s3Config: S3ServiceConfig = {
  bucketName: process.env.AWS_BUCKET_NAME as string,
  region: process.env.AWS_REGION as string,
};

const s3 = new S3Client({
  region: s3Config.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

/**
 * Fetches a file from S3 as a buffer
 * @param {string} bucketName - The S3 bucket name
 * @param {string} fileKey - The file key in S3
 * @returns {Promise<FileData>}
 */
export async function fetchFileFromS3(
  bucketName: string,
  fileKey: string
): Promise<FileData> {
  try {
    console.log(`Fetching file: ${fileKey} from S3 bucket: ${bucketName}`);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
    const data = await s3.send(command);

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
 * @param {string} bucketName - The S3 bucket name
 * @param {string} directoryPath - The S3 directory (prefix)
 * @returns {Promise<string[]>} - Array of file keys
 */
export async function listFilesInS3Directory(
  bucketName: string,
  directoryPath: string
): Promise<string[]> {
  try {
    console.log(`Listing files in S3 directory: ${directoryPath}`);
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: directoryPath,
    });

    const data = await s3.send(command);
    return data.Contents ? data.Contents.map((item) => item.Key as string) : [];
  } catch (error) {
    console.error("Error listing files in S3 directory:", error);
    throw error;
  }
}
