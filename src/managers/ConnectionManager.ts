import { S3Client } from "@aws-sdk/client-s3";
import { StorachaMigratorConfig } from "../types/index.js";
import { StorachaClient } from "../services/storachaService.js";
import { MongoDBService } from "../services/mongodbService.js";

export class ConnectionManager {
  private s3Connection: S3Client | null = null;
  private storachaConnection: StorachaClient | null = null;
  private mongoConnection: MongoDBService | null = null;
  private readonly config: StorachaMigratorConfig;

  constructor(config: StorachaMigratorConfig) {
    this.config = config;
  }

  async initializeConnections(): Promise<void> {
    try {
      // Initialize S3 connection if configured
      if (this.config.s3) {
        this.s3Connection = new S3Client({
          region: this.config.s3.region,
          credentials: this.config.s3.credentials,
        });
      }

      if (!this.config.storacha.email) {
        throw new Error("Storacha email is required");
      }

      const client = new StorachaClient();
      const validEmail = await client.validateEmail(this.config.storacha.email);
      this.storachaConnection = await StorachaClient.connect({
        email: validEmail,
      });

      // Initialize MongoDB connection if configured
      if (this.config.mongodb) {
        this.mongoConnection = new MongoDBService({
          uri: this.config.mongodb.uri,
          dbName: this.config.mongodb.dbName,
          options: this.config.mongodb.options,
        });
        await this.mongoConnection.connect();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initialize connections: ${message}`);
    }
  }

  async closeConnections(): Promise<void> {
    try {
      await this.storachaConnection?.disconnect();
      if (this.mongoConnection) {
        await this.mongoConnection.close();
        this.mongoConnection = null;
      }
      this.s3Connection = null;
      this.storachaConnection = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to close connections: ${message}`);
    }
  }

  getS3Connection(): S3Client {
    if (!this.s3Connection) {
      throw new Error("S3 connection not initialized");
    }
    return this.s3Connection;
  }

  getStorachaConnection(): StorachaClient {
    if (!this.storachaConnection) {
      throw new Error("Storacha connection not initialized");
    }
    return this.storachaConnection;
  }

  getMongoConnection(): MongoDBService {
    if (!this.mongoConnection) {
      throw new Error("MongoDB connection not initialized");
    }
    return this.mongoConnection;
  }
}
