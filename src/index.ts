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
 */
async function migrateFile(fileKey: string): Promise<void> {
  try {
    console.log(`🔄 Migrating file: ${fileKey}`);

    const { buffer, fileName }: FileData = await fetchFileFromS3(
      BUCKET_NAME,
      fileKey
    );
    const uploadResponse: UploadResponse = await uploadToStoracha(
      buffer,
      fileName
    );

    if (uploadResponse.success) {
      console.log(
        `✅ File ${fileName} successfully uploaded to Storacha: ${uploadResponse.url}`
      );
    } else {
      console.error(
        `❌ Failed to upload ${fileName} to Storacha:`,
        uploadResponse.error
      );
    }
  } catch (error) {
    console.error(`❌ Error migrating file ${fileKey}:`, error);
    throw error;
  }
}

/**
 * Transfers all files from an S3 directory to Storacha as a structured directory
 * @param {string} directoryPath - The S3 directory (prefix)
 */
async function migrateDirectory(directoryPath: string): Promise<void> {
  try {
    console.log(`📂 Migrating directory: ${directoryPath}`);

    const fileKeys = await listFilesInS3Directory(BUCKET_NAME, directoryPath);
    if (fileKeys.length === 0) {
      console.log("⚠️ No files found in directory");
      return;
    }

    console.log(`📝 Found ${fileKeys.length} files`);

    const filesData: FileData[] = [];
    for (const fileKey of fileKeys) {
      const fileData = await fetchFileFromS3(BUCKET_NAME, fileKey);
      filesData.push(fileData);
    }

    const uploadResponse = await uploadDirectoryToStoracha(filesData);
    if (uploadResponse.success) {
      console.log(
        `✅ Directory successfully uploaded to Storacha: ${uploadResponse.url}`
      );
    } else {
      console.error(
        "❌ Failed to upload directory to Storacha:",
        uploadResponse.error
      );
    }
  } catch (error) {
    console.error(`❌ Error migrating directory ${directoryPath}:`, error);
    throw error;
  }
}

/**
 * Creates a new Storacha space
 */
async function createSpace(): Promise<void> {
  try {
    const spaceName = createUniqueName();
    console.log(`🏗 Creating new space with name: ${spaceName}`);

    const response: SpaceResponse = await createNewStorachaSpace(spaceName);
    if (response.success) {
      console.log(`✅ Space created successfully! DID: ${response.did}`);
    } else {
      console.error("❌ Failed to create space:", response.error);
    }
  } catch (error) {
    console.error("❌ Error creating space:", error);
    throw error;
  }
}

/**
 * Sets the current space by DID in Storacha
 * @param {string} did - The DID of the space
 */
async function setSpace(did: string): Promise<void> {
  try {
    console.log(`🔄 Setting current space to: ${did}`);

    const response: SpaceResponse = await setCurrentSpaceByDID(did);
    if (response.success) {
      console.log("✅ Space set successfully!");
    } else {
      console.error("❌ Failed to set space:", response.error);
    }
  } catch (error) {
    console.error("❌ Error setting space:", error);
    throw error;
  }
}

// Handle user input
const args = process.argv.slice(2);

if (args.length === 2) {
  const [command, path] = args;

  switch (command) {
    case "file":
      migrateFile(path);
      break;
    case "dir":
      migrateDirectory(path);
      break;
    case "set-space":
      setSpace(path);
      break;
    default:
      console.error("❌ Invalid command. Use 'file', 'dir', or 'set-space'");
  }
} else if (args.length === 1 && args[0] === "create-space") {
  createSpace();
} else {
  console.error(`
❌ Invalid arguments.
Usage:
  - To migrate a file: node index.js file <file-key>
  - To migrate a directory: node index.js dir <directory-path>
  - To create a new space: node index.js create-space
  - To set current space: node index.js set-space <did>
  `);
}
