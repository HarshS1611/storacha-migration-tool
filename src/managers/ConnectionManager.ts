import { S3 } from "@aws-sdk/client-s3";
import { StorachaMigratorConfig } from "../types";
import { StorachaClient } from "../services/storachaService";

export class ConnectionManager {
  private s3Connection: S3 | null = null;
  private storachaConnection: StorachaClient | null = null;
  private readonly config: StorachaMigratorConfig;

  constructor(config: StorachaMigratorConfig) {
    this.config = config;
  }

  async initializeConnections(): Promise<void> {
    try {
      this.s3Connection = new S3({
        region: this.config.s3.region,
        credentials: this.config.s3.credentials,
      });

      if (!this.config.storacha.endpoint || !this.config.storacha.apiKey) {
        throw new Error("Storacha endpoint and apiKey are required");
      }

      this.storachaConnection = await StorachaClient.connect({
        endpoint: this.config.storacha.endpoint,
        apiKey: this.config.storacha.apiKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initialize connections: ${message}`);
    }
  }

  async closeConnections(): Promise<void> {
    try {
      await this.storachaConnection?.disconnect();
      this.s3Connection = null;
      this.storachaConnection = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to close connections: ${message}`);
    }
  }

  getS3Connection(): S3 {
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
}
