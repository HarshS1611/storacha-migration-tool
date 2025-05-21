import {
  StorachaMigratorConfig,
  Logger,
  FileData,
  UploadResponse,
  SpaceResponse,
  MigrationProgress,
  StorachaMigratorInterface,
  MigrationOptions,
  MigrationResult
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
  private readonly s3Service: S3Service;
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
    this.s3Service = new S3Service(config.s3, this.eventManager);

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
        phase: 'preparing',
        status: 'preparing',
        startTime,
        currentFile: fileKey,
        totalFiles: 1,
        completedFiles: 0
      });

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();

      this.eventManager.updateProgress({ 
        phase: 'download',
        status: 'downloading'
      });
      const fileData = await this.s3Service.fetchFileFromS3(fileKey);

      this.eventManager.updateProgress({ 
        phase: 'upload',
        status: 'uploading'
      });
      const result = await storacha.uploadToStoracha(
        fileData.buffer,
        fileData.fileName
      );

      const endTime = new Date();
      this.eventManager.updateProgress({
        status: result.success ? 'completed' : 'error',
        endTime,
        completedFiles: 1,
        percentage: 100
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

      const fileKeys = await this.s3Service.listFilesInS3Directory(directoryPath);
      if (fileKeys.length === 0) {
        throw new Error("⚠️ No files found in directory");
      }

      // Initialize progress with preparing phase
      this.eventManager.updateProgress({
        totalFiles: fileKeys.length,
        completedFiles: 0,
        percentage: 0,
        phase: 'preparing',
        status: 'preparing',
        startTime,
        currentFile: directoryPath,
        remainingFiles: fileKeys.length,
        totalBatches: Math.ceil(fileKeys.length / (this.migrationOptions?.batchSize || this.config.batch.size))
      });

      // Wait a moment for the UI to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Download phase
      this.eventManager.updateProgress({ 
        phase: 'download',
        status: 'downloading'
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      const filesData = await this.s3Service.fetchFilesInBatches(fileKeys);
      
      // Wait for download progress to be displayed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Upload phase
      this.eventManager.updateProgress({ 
        phase: 'upload',
        status: 'uploading'
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await storacha.uploadDirectoryToStoracha(filesData);

      // Final update
      const endTime = new Date();
      this.eventManager.updateProgress({
        completedFiles: fileKeys.length,
        percentage: 100,
        phase: 'preparing',
        status: result.success ? 'completed' : 'error',
        endTime,
        remainingFiles: 0
      });

      return result;
    }, `migrate directory ${directoryPath}`);
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
   * Generates a unique name for a new space
   * @private
   * @returns {string}
   */

  private validateConfig(config: StorachaMigratorConfig): StorachaMigratorConfig {
    if (!config.s3?.region) throw new Error('S3 region is required');
    if (!config.retry?.maxAttempts) throw new Error('Retry configuration is required');
    if (!config.batch?.size) config.batch = { size: 5, concurrency: 3 };
    if (!config.batch?.concurrency) config.batch.concurrency = 3;
    return config;
  }
}
