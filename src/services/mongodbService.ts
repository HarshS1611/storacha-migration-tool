import { MongoClient, Db } from "mongodb";
import { MongoDBServiceConfig, FileData } from "../types/index.js";
import { EventManager } from "../managers/EventManager.js";
import * as fs from "fs";
import * as path from "path";

export class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private readonly config: MongoDBServiceConfig;
  private eventManager?: EventManager;

  constructor(config: MongoDBServiceConfig, eventManager?: EventManager) {
    this.config = config;
    this.client = new MongoClient(config.uri, config.options);
    this.eventManager = eventManager;
  }

  /**
   * Initialize the MongoDB connection
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      throw error;
    }
  }

  /**
   * Closes the MongoDB connection
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
      throw error;
    }
  }

  /**
   * Lists all collections in the database
   * @returns {Promise<string[]>} - Array of collection names
   */
  async listCollections(): Promise<string[]> {
    if (!this.db) {
      throw new Error("MongoDB database not initialized");
    }

    try {
      const collections = await this.db.listCollections().toArray();
      return collections.map((collection) => collection.name);
    } catch (error) {
      console.error("Error listing collections:", error);
      throw error;
    }
  }

  /**
   * Fetches all documents from a collection and writes them to a JSON file
   * @param {string} collectionName - The name of the collection to fetch
   * @returns {Promise<FileData>} - The file data with the JSON content
   */
  async fetchCollection(collectionName: string): Promise<FileData> {
    if (!this.db) {
      throw new Error("MongoDB database not initialized");
    }

    try {
      // Mark the start of download phase
      this.eventManager?.updateProgress({ phase: "download" });

      const collection = this.db.collection(collectionName);
      const documents = await collection.find({}).toArray();

      // Create a temporary file to store the JSON data
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `${collectionName}.json`;
      const filePath = path.join(tempDir, fileName);

      // Convert documents to JSON string
      const jsonData = JSON.stringify(documents, null, 2);
      const buffer = Buffer.from(jsonData);

      // Write to file
      fs.writeFileSync(filePath, buffer);

      // Update progress
      if (this.eventManager) {
        const documentSize = buffer.length;
        this.eventManager.updateFileProgress(
          collectionName,
          documentSize,
          documentSize,
          "download"
        );
      }

      return {
        buffer,
        fileName,
      };
    } catch (error) {
      console.error(`Error fetching collection: ${collectionName}`, error);
      throw error;
    }
  }
}
