import { S3Client, GetObjectCommand, ListDirectoryBucketsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

// Initialize AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Fetches a file from S3 as a buffer
 * @param {string} bucketName - The S3 bucket name
 * @param {string} fileKey - The file key in S3
 * @returns {Promise<{ buffer: Buffer, fileName: string }>} 
 */
export async function fetchFileFromS3(bucketName, fileKey) {
  try {
    console.log(`Fetching file: ${fileKey} from S3 bucket: ${bucketName}`);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
    const data = await s3.send(command);
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
 * @returns {Promise<Array>} - Array of file keys
 */
export async function listFilesInS3Directory(bucketName, directoryPath) {
  try {
    console.log(`Listing files in S3 directory: ${directoryPath}`);
    const command = new ListDirectoryBucketsCommand({ Bucket: bucketName, Prefix: directoryPath });
    const data = await s3.send(command);
    return data.Contents ? data.Contents.map(item => item.Key) : [];
  } catch (error) {
    console.error("Error listing files in S3 directory:", error);
    throw error;
  }
}
