import {
  StorachaMigratorConfig,
  Logger,
  FileData,
  UploadResponse,
  SpaceResponse,
  MigrationProgress,
  StorachaMigratorInterface,
  MigrationOptions,
  MigrationResult,
} from "./types/index.js";
import { ConnectionManager } from "./managers/ConnectionManager.js";
import { EventManager } from "./managers/EventManager.js";
import { RetryManager } from "./managers/RetryManager.js";
import { DefaultLogger } from "./utils/DefaultLogger.js";
import { createUniqueName } from "./utils/nameGenerator.js";
import { S3Service } from "./services/s3Service.js";
import { UploadListItem } from "@web3-storage/upload-client/types";

export class StorachaMigrator implements StorachaMigratorInterface {
  private readonly config: StorachaMigratorConfig;
  private readonly logger: Logger;
  private readonly connectionManager: ConnectionManager;
  private readonly eventManager: EventManager;
  private readonly retryManager: RetryManager;
  private readonly s3Service?: S3Service;
  private migrationOptions?: MigrationOptions;

  constructor(
    config: StorachaMigratorConfig,
    options?: MigrationOptions,
    logger?: Logger
  ) {
    this.config = this.validateConfig(config);
    this.migrationOptions = options;
    this.logger = logger || new DefaultLogger();
    this.connectionManager = new ConnectionManager(config);
    this.eventManager = new EventManager();
    this.retryManager = new RetryManager(config.retry, this.logger);
    if (config.s3) {
      this.s3Service = new S3Service(config.s3, this.eventManager);
    }

    // Set up callbacks if provided in options
    if (options?.progressCallback) {
      this.onProgress(options.progressCallback);
    }
    if (options?.errorCallback) {
      this.onError(options.errorCallback);
    }
  }

  async initialize(): Promise<void> {
    await this.connectionManager.initializeConnections();
  }

  async close(): Promise<void> {
    await this.connectionManager.closeConnections();
    this.eventManager.close();
  }

  async migrateFile(fileKey: string): Promise<UploadResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`🔄 Migrating file: ${fileKey}`);

      const startTime = new Date();
      this.eventManager.updateProgress({
        phase: "preparing",
        status: "preparing",
        startTime,
        currentFile: fileKey,
        totalFiles: 1,
        completedFiles: 0,
      });

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();
      if (!this.s3Service) {
        throw new Error("S3 service not initialized");
      }

      this.eventManager.updateProgress({
        phase: "download",
        status: "downloading",
      });
      const fileData = await this.s3Service.fetchFileFromS3(fileKey);

      this.eventManager.updateProgress({
        phase: "upload",
        status: "uploading",
      });
      const result = await storacha.uploadToStoracha(
        fileData.buffer,
        fileData.fileName
      );

      const endTime = new Date();
      this.eventManager.updateProgress({
        status: result.success ? "completed" : "error",
        endTime,
        completedFiles: 1,
        percentage: 100,
      });

      this.eventManager.emit("fileComplete", fileKey, result);
      return result;
    }, `migrate file ${fileKey}`);
  }

  async migrateDirectory(directoryPath: string): Promise<UploadResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`📂 Migrating directory: ${directoryPath}`);
      const startTime = new Date();

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();
      if (!this.s3Service) {
        throw new Error("S3 service not initialized");
      }

      const fileKeys = await this.s3Service.listFilesInS3Directory(
        directoryPath
      );
      if (fileKeys.length === 0) {
        throw new Error("⚠️ No files found in directory");
      }

      // Initialize progress with preparing phase
      this.eventManager.updateProgress({
        totalFiles: fileKeys.length,
        completedFiles: 0,
        percentage: 0,
        phase: "preparing",
        status: "preparing",
        startTime,
        currentFile: directoryPath,
        remainingFiles: fileKeys.length,
        totalBatches: Math.ceil(
          fileKeys.length /
            (this.migrationOptions?.batchSize || this.config.batch.size)
        ),
      });

      // Wait a moment for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Download phase
      this.eventManager.updateProgress({
        phase: "download",
        status: "downloading",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filesData = await this.s3Service.fetchFilesInBatches(fileKeys);

      // Wait for download progress to be displayed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Upload phase
      this.eventManager.updateProgress({
        phase: "upload",
        status: "uploading",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = await storacha.uploadDirectoryToStoracha(filesData);

      // Final update
      const endTime = new Date();
      this.eventManager.updateProgress({
        completedFiles: fileKeys.length,
        percentage: 100,
        phase: "preparing",
        status: result.success ? "completed" : "error",
        endTime,
        remainingFiles: 0,
      });

      return result;
    }, `migrate directory ${directoryPath}`);
  }

  /**
   * Migrates a MongoDB collection to Storacha
   * @param {string} collectionName - The name of the collection to migrate (optional)
   * @returns {Promise<UploadResponse>}
   */
  async migrateMongoDb(collectionName?: string): Promise<UploadResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(
        collectionName
          ? `🔄 Migrating MongoDB collection: ${collectionName}`
          : "🔄 Migrating all MongoDB collections"
      );
      const startTime = new Date();

      // Get connections
      const mongodb = this.connectionManager.getMongoConnection();
      const storacha = this.connectionManager.getStorachaConnection();

      // Initialize progress with preparing phase
      this.eventManager.updateProgress({
        phase: "preparing",
        status: "preparing",
        startTime,
        currentFile: collectionName || "MongoDB collections",
        totalFiles: 0, // Will be updated once we know how many collections
        completedFiles: 0,
      });

      // Get collections to migrate
      let collectionsToExport: string[] = [];
      if (collectionName) {
        collectionsToExport = [collectionName];
      } else {
        // List all collections and export them
        collectionsToExport = await mongodb.listCollections();
      }

      if (collectionsToExport.length === 0) {
        throw new Error("⚠️ No collections found to export");
      }

      // Update progress with total collections
      this.eventManager.updateProgress({
        totalFiles: collectionsToExport.length,
        remainingFiles: collectionsToExport.length,
      });

      // Wait a moment for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Process each collection
      const exportedFiles: FileData[] = [];
      let completedCollections = 0;

      for (const collection of collectionsToExport) {
        try {
          // Download phase - export collection to JSON
          this.eventManager.updateProgress({
            phase: "download",
            status: "downloading",
            currentFile: collection,
          });

          const fileData = await mongodb.fetchCollection(collection);
          exportedFiles.push(fileData);
          completedCollections++;

          this.eventManager.updateProgress({
            completedFiles: completedCollections,
            percentage:
              (completedCollections / collectionsToExport.length) * 100,
            remainingFiles: collectionsToExport.length - completedCollections,
          });
        } catch (error) {
          this.logger.error(
            `Error exporting collection ${collection}`,
            error instanceof Error ? error : new Error(String(error))
          );
          this.eventManager.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
            collection
          );
        }
      }

      if (exportedFiles.length === 0) {
        throw new Error("⚠️ No collections were successfully exported");
      }

      // Upload phase - upload exported JSON files to Storacha
      this.eventManager.updateProgress({
        phase: "upload",
        status: "uploading",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await storacha.uploadDirectoryToStoracha(exportedFiles);

      // Final update
      const endTime = new Date();
      this.eventManager.updateProgress({
        completedFiles: exportedFiles.length,
        percentage: 100,
        phase: "completed",
        status: result.success ? "completed" : "error",
        endTime,
        remainingFiles: 0,
      });

      return result;
    }, `migrate MongoDB ${collectionName || "collections"}`);
  }

  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.eventManager.onProgress(callback);
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.eventManager.onError(callback);
  }

  /**
   * Creates a new Storacha space with a unique name
   * @returns {Promise<SpaceResponse>}
   */
  async createSpace(): Promise<SpaceResponse> {
    return await this.retryManager.withRetry(async () => {
      const spaceName = createUniqueName();
      this.logger.info(`🏗 Creating new space: ${spaceName}`);

      const storacha = this.connectionManager.getStorachaConnection();
      return await storacha.createNewStorachaSpace(spaceName);
    }, "create space");
  }

  /**
   * Sets the current space by DID
   * @param {string} did - The DID of the space
   * @returns {Promise<SpaceResponse>}
   */
  async setSpace(did: string): Promise<SpaceResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`🔄 Setting current space to: ${did}`);

      const storacha = this.connectionManager.getStorachaConnection();
      return await storacha.setCurrentSpaceByDID(did);
    }, `set space ${did}`);
  }

  /**
   * Lists all spaces
   * @returns {Promise<SpaceResponse[]>}
   */
  async listSpaces(): Promise<SpaceResponse[]> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`📜 Listing all spaces`);

      const storacha = this.connectionManager.getStorachaConnection();
      return await storacha.getAllSpaces();
    }, "list spaces");
  }

  /**
   * Deletes a space by DID
   * @param {string} did - The DID of the space
   * @returns {Promise<void>}
   */

  async listFilesInSpace(did: string): Promise<UploadListItem[]> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`📜 Listing all files in space: ${did}`);

      const storacha = this.connectionManager.getStorachaConnection();
      return await storacha.getAllUploads();
    }, `list all uploaded files`);
  }

  /**
   * Retrieves files from a space and saves them to a download folder
   * @param {string} did - The DID of the space
   * @param {string} downloadPath - Path to save the downloaded files (defaults to './downloads')
   * @returns {Promise<{cid: string, path: string}[]>} - Array of downloaded file information
   */
  async retrieveFilesInSpace(
    did: string,
    downloadPath: string = "./downloads"
  ) {
    return await this.retryManager.withRetry(async () => {
      const listFilesInSpace = await this.listFilesInSpace(did);
      this.logger.info(`📜 Retrieving all files in space: ${did}`);

      const fs = await import("fs");
      const path = await import("path");
      const https = await import("https");

      // Create download directory if it doesn't exist
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.logger.info(`Created download directory: ${downloadPath}`);
      }

      const downloadResults: { cid: string; path: string }[] = [];

      // Track progress
      let completedFiles = 0;
      const totalFiles = listFilesInSpace.length;

      this.eventManager.updateProgress({
        phase: "download",
        status: "downloading",
        totalFiles,
        completedFiles: 0,
        percentage: 0,
      });

      // Download each file
      for (const file of listFilesInSpace) {
        try {
          const cid = file.root.toString();
          this.eventManager.updateProgress({
            currentFile: cid,
          });

          // First check if the CID is a directory by getting the content
          const gatewayUrl = `https://${cid}.ipfs.w3s.link`;
          this.logger.info(`Checking content type for CID: ${cid}`);

          // Get the content as text to check if it's HTML directory listing
          const content = await this.fetchContent(gatewayUrl);

          // Check if content is HTML and contains directory listing
          if (content.includes("<html") && content.includes(`/ipfs/${cid}/`)) {
            this.logger.info(`CID ${cid} is a directory, extracting files...`);

            // Parse HTML to extract file links
            const fileLinks = this.extractFileLinksFromHtml(content);

            if (fileLinks.length === 0) {
              this.logger.info(`No files found in directory ${cid}`);
              continue;
            }

            this.logger.info(
              `Found ${fileLinks.length} files in directory ${cid}`
            );

            // Download each file in the directory
            for (const fileLink of fileLinks) {
              const filename = `${cid.slice(0, 8)}-${fileLink.filename}`;
              const fileCid = fileLink.cid;

              // Skip parent directory links
              if (filename === "..") continue;

              const filePath = path.join(downloadPath, filename);
              const fileUrl = `https://${fileCid}.ipfs.w3s.link`;

              this.logger.info(
                `Downloading file: ${filename} (CID: ${fileCid})`
              );
              this.eventManager.updateProgress({
                currentFile: filename,
              });

              // Download the file
              await this.downloadFile(fileUrl, filePath);

              this.logger.info(`✅ Downloaded ${filename} to ${filePath}`);

              downloadResults.push({
                cid: fileCid,
                path: filePath,
              });

              // Update progress
              completedFiles++;
              this.eventManager.updateProgress({
                completedFiles,
                percentage: (completedFiles / totalFiles) * 100,
              });
            }
          } else {
            // It's a single file, download it directly
            const filename = `file-${cid.slice(0, 8)}`;
            const filePath = path.join(downloadPath, filename);

            this.logger.info(`Downloading file with CID: ${cid}`);
            this.eventManager.updateProgress({
              currentFile: filename,
            });

            // Download the file
            await this.downloadFile(gatewayUrl, filePath);

            this.logger.info(`✅ Downloaded to ${filePath}`);

            downloadResults.push({
              cid,
              path: filePath,
            });

            // Update progress
            completedFiles++;
            this.eventManager.updateProgress({
              completedFiles,
              percentage: (completedFiles / totalFiles) * 100,
            });
          }
        } catch (error) {
          this.logger.error(
            `❌ Failed to download file with CID ${file.root.toString()}: ${error}`
          );
          this.eventManager.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
            file.root.toString()
          );
        }
      }

      this.eventManager.updateProgress({
        status: "completed",
        phase: "completed",
      });

      return downloadResults;
    }, `retrieve all files from space ${did}`);
  }

  /**
   * Downloads a file from a URL to a local path
   * @param {string} url - The URL to download from
   * @param {string} filePath - The local path to save the file to
   * @returns {Promise<void>}
   * @private
   */
  private async downloadFile(url: string, filePath: string): Promise<void> {
    const fs = await import("fs");
    const https = await import("https");

    return new Promise<void>((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode === 200) {
            const fileStream = fs.createWriteStream(filePath);
            response.pipe(fileStream);

            fileStream.on("finish", () => {
              fileStream.close();
              resolve();
            });

            fileStream.on("error", (err) => {
              fs.unlinkSync(filePath);
              reject(err);
            });
          } else {
            reject(
              new Error(`Failed to download from URL: ${response.statusCode}`)
            );
          }
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  /**
   * Fetches content from a URL as text
   * @param {string} url - The URL to fetch from
   * @returns {Promise<string>} - The content as text
   * @private
   */
  private async fetchContent(url: string): Promise<string> {
    const https = await import("https");

    return new Promise<string>((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode === 200) {
            let data = "";

            response.on("data", (chunk) => {
              data += chunk;
            });

            response.on("end", () => {
              resolve(data);
            });
          } else {
            reject(
              new Error(`Failed to fetch content: ${response.statusCode}`)
            );
          }
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  /**
   * Extracts file links from an HTML directory listing
   * @param {string} html - The HTML content to parse
   * @returns {Array<{filename: string, cid: string}>} - Array of file links
   * @private
   */
  private extractFileLinksFromHtml(
    html: string
  ): Array<{ filename: string; cid: string }> {
    // Simple regex-based extraction of file links
    const fileLinks: Array<{ filename: string; cid: string }> = [];

    // Extract file links of pattern href="/ipfs/{CID}/{filename}"
    const fileRegex =
      /<a href="\/ipfs\/[^"]+\/([^"]+)"[^>]*>.*?<\/a>[\s\S]*?<a class="ipfs-hash"[^>]*href="\/ipfs\/([^?"]+)/g;
    let match;

    while ((match = fileRegex.exec(html)) !== null) {
      const filename = match[1];
      const cid = match[2];

      // Skip parent directory link
      if (filename !== "..") {
        fileLinks.push({ filename, cid });
      }
    }

    return fileLinks;
  }

  /**
   * Generates a unique name for a new space
   * @private
   * @returns {string}
   */

  private validateConfig(
    config: StorachaMigratorConfig
  ): StorachaMigratorConfig {
    if (config.s3) {
      if (!config.s3?.region) throw new Error("S3 region is required");
    }
    if (config.mongodb) {
      if (!config.mongodb.uri) throw new Error("MongoDB URI is required");
      if (!config.mongodb.dbName)
        throw new Error("MongoDB database name is required");
    }
    if (!config.retry?.maxAttempts)
      throw new Error("Retry configuration is required");
    if (!config.batch?.size) config.batch = { size: 5, concurrency: 3 };
    if (!config.batch?.concurrency) config.batch.concurrency = 3;
    return config;
  }
}
