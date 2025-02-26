import { 
  fetchFileFromS3, 
  listFilesInS3Directory 
} from "./services/s3Service.js";

import { 
  uploadToStoracha, 
  uploadDirectoryToStoracha, 
  createNewStorachaSpace, 
  setCurrentSpaceByDID 
} from "./services/storachaService.js";

import { createUniqueName } from "./utils/nameGenerator.js";

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
* Transfers a single file from S3 to Storacha
* @param {string} fileKey - The file key in S3
*/
async function migrateFile(fileKey) {
  try {
      console.log(`🔄 Migrating file: ${fileKey}`);

      const { buffer, fileName } = await fetchFileFromS3(BUCKET_NAME, fileKey);
      const uploadResponse = await uploadToStoracha(buffer, fileName);

      if (uploadResponse.success) {
          console.log(`✅ File ${fileName} successfully uploaded to Storacha: ${uploadResponse.url}`);
      } else {
          console.log(`❌ Failed to upload file ${fileName}`);
      }
  } catch (error) {
      console.error("Migration failed:", error);
  }
}

/**
* Transfers all files from an S3 directory to Storacha as a structured directory
* @param {string} directoryPath - The S3 directory (prefix)
*/
async function migrateDirectory(directoryPath) {
  try {
      console.log(`📂 Fetching all files from directory: ${directoryPath}`);
      const fileKeys = await listFilesInS3Directory(BUCKET_NAME, directoryPath);

      if (!fileKeys.length) {
          console.log("⚠️ No files found in the directory.");
          return;
      }

      console.log(`📂 Found ${fileKeys.length} files. Preparing upload...`);

      // Fetch all files from S3
      const filesArray = await Promise.all(fileKeys.map(async (fileKey) => {
          const { buffer, fileName } = await fetchFileFromS3(BUCKET_NAME, fileKey);
          return { buffer, fileName };
      }));

      // Upload all files as a directory
      const uploadResponse = await uploadDirectoryToStoracha(filesArray);

      if (uploadResponse.success) {
          console.log(`✅ Directory successfully uploaded to Storacha: ${uploadResponse.url}`);
      } else {
          console.log(`❌ Failed to upload directory`);
      }
  } catch (error) {
      console.error("Error during directory migration:", error);
  }
}

/**
* Creates a new Storacha space
*/
async function createSpace() {
  try {
    const spaceName = createUniqueName();
      console.log(`🚀 Creating a new space: ${spaceName}`);
      const response = await createNewStorachaSpace(spaceName);

      if (response.success) {
          console.log(`✅ Space created successfully with DID: ${response.did}`);
      } else {
          console.log(`❌ Failed to create space.`);
      }
  } catch (error) {
      console.error("Error creating space:", error);
  }
}

/**
* Sets the current space by DID in Storacha
* @param {string} did - The DID of the space
*/
async function setSpace(did) {
  try {
      console.log(`🔄 Setting current space to: ${did}`);
      const response = await setCurrentSpaceByDID(did);

      if (response.success) {
          console.log(`✅ Space successfully set to ${did}`);
      } else {
          console.log(`❌ Failed to set space.`);
      }
  } catch (error) {
      console.error("Error setting space:", error);
  }
}

// Handle user input
const args = process.argv.slice(2);

if (args.length === 2) {
  const action = args[0];
  const value = args[1];

  if (action === "file") {
      migrateFile(value);
  } else if (action === "dir") {
      migrateDirectory(value);
  } else if (action === "create-space") {
      createSpace();
  } else if (action === "set-space") {
      setSpace(value);
  } else {
      console.log("❌ Invalid command. Use:\n" +
          "  node src/index.js file <file-key>\n" +
          "  node src/index.js dir <directory-path>\n" +
          "  node src/index.js create-space <space-name>\n" +
          "  node src/index.js set-space <DID>");
  }
} else {
  console.log("⚠️ Usage: \n" +
      "   node src/index.js file <file-key>  (Upload a single file)\n" +
      "   node src/index.js dir <directory-path>  (Upload all files from a directory)\n" +
      "   node src/index.js create-space <space-name>  (Create a new Storacha space)\n" +
      "   node src/index.js set-space <DID>  (Set the current Storacha space)");
}
