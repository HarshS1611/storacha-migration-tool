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

    if (options?.progressCallback) this.onProgress(options.progressCallback);
    if (options?.errorCallback) this.onError(options.errorCallback);
  }

  async initialize(): Promise<void> {
    await this.connectionManager.initializeConnections();
  }

  async close(): Promise<void> {
    await this.connectionManager.closeConnections();
    this.eventManager.close();
  }

  async migrateFile(fileKey: string): Promise<UploadResponse> {
    return this.retryManager.withRetry(async () => {
      this.logger.info(`🔄 Migrating file: ${fileKey}`);
      this.updateProgress('preparing', 'preparing', { currentFile: fileKey, totalFiles: 1 });

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();

      this.updateProgress('download', 'downloading');
      const fileData = await this.s3Service.fetchFileFromS3(fileKey);

      this.updateProgress('upload', 'uploading');
      const result = await storacha.uploadToStoracha(fileData.buffer, fileData.fileName);

      this.updateProgress(result.success ? 'completed' : 'error' as MigrationProgress['phase'], result.success ? 'completed' : 'error', {
        completedFiles: 1,
        percentage: 100
      });

      this.eventManager.emit("fileComplete", fileKey, result);
      return result;
    }, `migrate file ${fileKey}`);
  }

  async migrateDirectory(directoryPath: string): Promise<UploadResponse> {
    return this.retryManager.withRetry(async () => {
      this.logger.info(`📂 Migrating directory: ${directoryPath}`);
      const fileKeys = await this.s3Service.listFilesInS3Directory(directoryPath);
      if (fileKeys.length === 0) throw new Error("⚠️ No files found in directory");

      this.updateProgress('preparing', 'preparing', {
        totalFiles: fileKeys.length,
        currentFile: directoryPath,
        totalBatches: Math.ceil(fileKeys.length / (this.migrationOptions?.batchSize || this.config.batch.size))
      });

      const filesData = await this.s3Service.fetchFilesInBatches(fileKeys);
      const storacha = this.connectionManager.getStorachaConnection();

      this.updateProgress('upload', 'uploading');
      const result = await storacha.uploadDirectoryToStoracha(filesData);

      this.updateProgress(result.success ? 'completed' : 'error' as MigrationProgress['phase'], result.success ? 'uploading' : 'failed' as MigrationProgress['status'], {
        completedFiles: fileKeys.length,
        percentage: 100
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

  async createSpace(): Promise<SpaceResponse> {
    return this.retryManager.withRetry(async () => {
      const spaceName = createUniqueName();
      this.logger.info(`🏗 Creating new space: ${spaceName}`);
      const storacha = this.connectionManager.getStorachaConnection();
      return storacha.createNewStorachaSpace(spaceName);
    }, "create space");
  }

  async setSpace(did: string): Promise<SpaceResponse> {
    return this.retryManager.withRetry(async () => {
      this.logger.info(`🔄 Setting current space to: ${did}`);
      const storacha = this.connectionManager.getStorachaConnection();
      return storacha.setCurrentSpaceByDID(did);
    }, `set space ${did}`);
  }

  async listSpaces(): Promise<SpaceResponse[]> {
    return this.retryManager.withRetry(async () => {
      this.logger.info(`📜 Listing all spaces`);
      const storacha = this.connectionManager.getStorachaConnection();
      return storacha.getAllSpaces();
    }, "list spaces");
  }

  async listFilesInSpace(did: string): Promise<UploadListItem[]> {
    return this.retryManager.withRetry(async () => {
      this.logger.info(`📜 Listing all files in space: ${did}`);
      const storacha = this.connectionManager.getStorachaConnection();
      return storacha.getAllUploads();
    }, `list all uploaded files`);
  }

  private validateConfig(config: StorachaMigratorConfig): StorachaMigratorConfig {
    if (!config.s3?.region) throw new Error('S3 region is required');
    if (!config.retry?.maxAttempts) throw new Error('Retry configuration is required');
    config.batch = { size: config.batch?.size || 5, concurrency: config.batch?.concurrency || 3 };
    return config;
  }

  private updateProgress(
    phase: MigrationProgress['phase'],
    status: MigrationProgress['status'],
    additionalData?: Partial<MigrationProgress>
  ): void {
    this.eventManager.updateProgress({ phase, status, ...additionalData });
  }
}