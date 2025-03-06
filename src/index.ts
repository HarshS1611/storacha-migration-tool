import {
  fetchFileFromS3,
  listFilesInS3Directory,
} from "./services/s3Service.js";

import {
  uploadToStoracha,
  uploadDirectoryToStoracha,
  createNewStorachaSpace,
  setCurrentSpaceByDID,
} from "./services/storachaService.js";

import { createUniqueName } from "./utils/nameGenerator.js";
import { FileData, UploadResponse, SpaceResponse } from "./types/index.js";
import dotenv from "dotenv";
dotenv.config();

const BUCKET_NAME = process.env.S3_BUCKET_NAME as string;
if (!BUCKET_NAME) {
  throw new Error("S3_BUCKET_NAME environment variable is not set");
}

/**
 * Transfers a single file from S3 to Storacha
 * @param {string} fileKey - The file key in S3
 * @returns {Promise<UploadResponse>}
 */
export async function migrateFile(fileKey: string): Promise<UploadResponse> {
  try {
    console.log(`🔄 Migrating file: ${fileKey}`);
    const { buffer, fileName }: FileData = await fetchFileFromS3(
      BUCKET_NAME,
      fileKey
    );

    return await uploadToStoracha(buffer, fileName);
  } catch (error) {
    console.error(`❌ Error migrating file ${fileKey}:`, error);
    throw error;
  }
}

/**
 * Transfers all files from an S3 directory to Storacha
 * @param {string} directoryPath - The S3 directory (prefix)
 * @returns {Promise<UploadResponse>}
 */
export async function migrateDirectory(
  directoryPath: string
): Promise<UploadResponse> {
  try {
    console.log(`📂 Migrating directory: ${directoryPath}`);

    const fileKeys = await listFilesInS3Directory(BUCKET_NAME, directoryPath);
    if (fileKeys.length === 0) {
      throw new Error("⚠️ No files found in directory");
    }

    console.log(`📝 Found ${fileKeys.length} files`);
    const filesData = await Promise.all(
      fileKeys.map((fileKey) => fetchFileFromS3(BUCKET_NAME, fileKey))
    );

    return await uploadDirectoryToStoracha(filesData);
  } catch (error) {
    console.error(`❌ Error migrating directory ${directoryPath}:`, error);
    throw error;
  }
}

/**
 * Creates a new Storacha space
 * @returns {Promise<SpaceResponse>}
 */
export async function createSpace(): Promise<SpaceResponse> {
  try {
    const spaceName = createUniqueName();
    console.log(`🏗 Creating new space: ${spaceName}`);
    return await createNewStorachaSpace(spaceName);
  } catch (error) {
    console.error("❌ Error creating space:", error);
    throw error;
  }
}

/**
 * Sets the current space by DID in Storacha
 * @param {string} did - The DID of the space
 * @returns {Promise<SpaceResponse>}
 */
export async function setSpace(did: string): Promise<SpaceResponse> {
  try {
    console.log(`🔄 Setting current space to: ${did}`);
    return await setCurrentSpaceByDID(did);
  } catch (error) {
    console.error("❌ Error setting space:", error);
    throw error;
  }
}

export { migrateFile, migrateDirectory, createSpace, setSpace };
