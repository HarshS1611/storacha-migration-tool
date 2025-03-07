import {
  StorachaMigratorConfig,
  Logger,
  FileData,
  UploadResponse,
  SpaceResponse,
  MigrationProgress,
} from "./types";
import { ConnectionManager } from "./managers/ConnectionManager";
import { EventManager } from "./managers/EventManager";
import { RetryManager } from "./managers/RetryManager";
import { DefaultLogger } from "./utils/DefaultLogger";
import { createUniqueName } from "./utils/nameGenerator";
import { S3Service } from "./services/s3Service";

export class StorachaMigrator {
  private readonly config: StorachaMigratorConfig;
  private readonly logger: Logger;
  private readonly connectionManager: ConnectionManager;
  private readonly eventManager: EventManager;
  private readonly retryManager: RetryManager;
  private readonly s3Service: S3Service;

  constructor(config: StorachaMigratorConfig, logger?: Logger) {
    this.config = this.validateConfig(config);
    this.logger = logger || new DefaultLogger();
    this.connectionManager = new ConnectionManager(config);
    this.eventManager = new EventManager();
    this.retryManager = new RetryManager(config.retry, this.logger);
    this.s3Service = new S3Service(config.s3);
  }

  async initialize(): Promise<void> {
    await this.connectionManager.initializeConnections();
  }

  async close(): Promise<void> {
    await this.connectionManager.closeConnections();
  }

  async migrateFile(fileKey: string): Promise<UploadResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`🔄 Migrating file: ${fileKey}`);

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();

      const fileData = await this.s3Service.fetchFileFromS3(fileKey);
      const result = await storacha.uploadToStoracha(
        fileData.buffer,
        fileData.fileName
      );

      this.eventManager.emit("fileComplete", fileKey, result);
      return result;
    }, `migrate file ${fileKey}`);
  }

  async migrateDirectory(directoryPath: string): Promise<UploadResponse> {
    return await this.retryManager.withRetry(async () => {
      this.logger.info(`📂 Migrating directory: ${directoryPath}`);

      const s3 = this.connectionManager.getS3Connection();
      const storacha = this.connectionManager.getStorachaConnection();

      const fileKeys = await this.s3Service.listFilesInS3Directory(
        directoryPath
      );
      if (fileKeys.length === 0) {
        throw new Error("⚠️ No files found in directory");
      }

      this.eventManager.updateProgress({
        totalFiles: fileKeys.length,
        completedFiles: 0,
        percentage: 0,
      });

      const filesData = await this.s3Service.fetchFilesInBatches(fileKeys);
      const result = await storacha.uploadDirectoryToStoracha(filesData);

      this.eventManager.updateProgress({
        completedFiles: fileKeys.length,
        percentage: 100,
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
   * Generates a unique name for a new space
   * @private
   * @returns {string}
   */

  private validateConfig(config: StorachaMigratorConfig): StorachaMigratorConfig {
    if (!config.s3?.region) throw new Error('S3 region is required');
    if (!config.retry?.maxAttempts) throw new Error('Retry configuration is required');
    return config;
  }
}
