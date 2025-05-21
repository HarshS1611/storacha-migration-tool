import { create, Client } from "@web3-storage/w3up-client";
import { UploadResponse, SpaceResponse, FileData } from "../types/index.js";
import { uploadDirectory, uploadFile } from '@web3-storage/upload-client'
import { store } from '@web3-storage/capabilities/store'
import { upload } from '@web3-storage/capabilities/upload'
import { fetchWithUploadProgress } from '@web3-storage/upload-client/fetch-with-upload-progress'
import { EventManager } from "../managers/EventManager.js";
import dotenv from "dotenv";
import { InvocationConfig, ProgressStatus, UploadListItem } from "@web3-storage/upload-client/types";

dotenv.config();

interface IStorachaClient extends Client {
  login: (email: `${string}@${string}`) => Promise<any>;
  uploadDirectory: (files: File[]) => Promise<any>;
}

interface StorachaAccount {
  plan: {
    wait: () => Promise<any>;
  };
  agent: {
    getSpaceInfo: () => Promise<{ did: string }>;
  };
}

interface Space {
  did: () => string;
}

export class StorachaClient {
  private client!: Client;
  private account!: any;
  private eventManager?: EventManager;
  private isUploading: boolean = false;

  constructor(eventManager?: EventManager) {
    this.eventManager = eventManager;
  }

  private async initialize() {
    if (!this.client) {
      this.client = await create();
    }
  }

  async validateEmail(email: string): Promise<`${string}@${string}`> {
    if (!email || !email.includes("@")) {
      throw new Error(
        "Invalid email format. Email must be in the format user@domain"
      );
    }
    return email as `${string}@${string}`;
  }

  async initializeClient(): Promise<{
    client: IStorachaClient;
    account: StorachaAccount;
  }> {
    try {
      console.log("🛠 Initializing Storacha client...");
      const client = await create();
      console.log("🔑 Logging in to Storacha...");
      const email = process.env.STORACHA_EMAIL;
      if (!email) {
        throw new Error("STORACHA_EMAIL environment variable is not set");
      }
      const validEmail = await this.validateEmail(email);
      const account = await client.login(validEmail);
      console.log(`✅ Logged into Storacha with email: ${email}`);
      return {
        client: client as unknown as IStorachaClient,
        account: account as StorachaAccount,
      };
    } catch (error) {
      console.error("❌ Error initializing client:", error);
      throw error;
    }
  }

  async waitForPlanActivation(account: StorachaAccount): Promise<void> {
    try {
      console.log("⏳ Waiting for payment plan activation...");
      await account.plan.wait();
      console.log("✅ Payment plan confirmed.");
    } catch (error) {
      console.error("❌ Error waiting for plan activation:", error);
      throw error;
    }
  }

  async uploadToStoracha(
    fileBuffer: Buffer,
    fileName: string
  ): Promise<UploadResponse> {
    try {
      const { client, account } = await this.initializeClient();
      await this.waitForPlanActivation(account);

      console.log("🔍 Fetching user's current space...");
      const res = await account.agent.getSpaceInfo();
      if (!res || !res.did) {
        throw new Error("❌ No space found! Please create a new space first.");
      }

      const space = res;
      await client.setCurrentSpace(space.did as any);
      console.log(`✅ Using existing space: ${space.did}`);

      const conf: InvocationConfig = {
        issuer: client.agent.issuer,
        with: space.did as `did:${string}:${string}`,
        proofs: client.proofs(),
      };

      const file = new File([fileBuffer], fileName);
      console.log(`📤 Uploading file: ${fileName}...`);
      
      const cid = await uploadFile(conf, file, {
        onUploadProgress: (progress: ProgressStatus) => {
          this.eventManager?.updateUploadProgress({
            ...progress,
            phase: 'upload'
          });
        },
        fetchWithUploadProgress // Enable XHR-based progress tracking
      });

      console.log(`✅ File uploaded successfully! CID: ${cid.toString()}`);

      return {
        success: true,
        cid: cid.toString(),
        url: `https://${cid.toString()}.ipfs.w3s.link`,
        size: fileBuffer.length,
        status: "success",
      };
    } catch (error) {
      console.error("❌ Error uploading file to Storacha:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      };
    }
  }

  async uploadDirectoryToStoracha(
    filesArray: { buffer: Buffer; fileName: string }[]
  ): Promise<UploadResponse> {
    if (this.isUploading) {
      return {
        success: false,
        error: "Upload already in progress",
        status: "failed"
      };
    }

    this.isUploading = true;
    try {
      // Step 1: Initialize and authenticate (without progress updates)
      await this.initialize();
      const { client, account } = await this.initializeClient();
      await this.waitForPlanActivation(account);

      console.log("🔍 Fetching user's current space...");
      const res = await account.agent.getSpaceInfo();
      if (!res || !res.did) {
        throw new Error("❌ No space found! Please create a new space first.");
      }

      const space = res;
      await client.setCurrentSpace(space.did as any);
      console.log(`✅ Using existing space: ${space.did}`);

      // Step 2: Prepare files and configuration
      const files = filesArray.map(
        ({ buffer, fileName }) => new File([buffer], fileName)
      );
      
      const conf: InvocationConfig = {
        issuer: client.agent.issuer,
        with: space.did as `did:${string}:${string}`,
        proofs: client.agent.proofs(),
      };

      // Calculate total upload size
      const totalUploadBytes = filesArray.reduce((acc, file) => acc + file.buffer.length, 0);
      let totalBytesUploaded = 0;
      let lastBytesUploaded = 0;

      console.log(`📂 Uploading ${files.length} files as a directory (Total size: ${this.formatBytes(totalUploadBytes)})...`);
      
      // Step 3: Initialize upload progress
      this.eventManager?.updateProgress({
        phase: 'upload',
        uploadedBytes: 0,
        totalUploadBytes,
        currentFile: 'Starting directory upload...',
        totalFiles: files.length,
        completedFiles: 0,
        percentage: 0,
        uploadSpeed: 0
      });

      // Step 4: Start upload with progress tracking
      let lastProgressUpdate = Date.now();
      let uploadStartTime = Date.now();
      let lastSpeedUpdate = Date.now();
      let uploadSpeed = 0;

      const directoryCid = await uploadDirectory(conf, files, {
        onUploadProgress: (progress: ProgressStatus) => {
          const now = Date.now();
          if (now - lastProgressUpdate > 100) { // Throttle updates to every 100ms
            // Calculate actual bytes uploaded
            const currentBytesUploaded = progress.loaded || 0;
            if (currentBytesUploaded > lastBytesUploaded) {
              totalBytesUploaded += (currentBytesUploaded - lastBytesUploaded);
              lastBytesUploaded = currentBytesUploaded;
            }

            // Calculate upload speed every second
            if (now - lastSpeedUpdate > 1000) {
              const elapsedSeconds = (now - uploadStartTime) / 1000;
              const bytesPerSecond = totalBytesUploaded / elapsedSeconds;
              uploadSpeed = bytesPerSecond;
              lastSpeedUpdate = now;
            }

            const percentage = (totalBytesUploaded / totalUploadBytes) * 100;
            
            console.log(`Debug: Upload progress - ${this.formatBytes(totalBytesUploaded)}/${this.formatBytes(totalUploadBytes)} (${percentage.toFixed(1)}%) at ${this.formatBytes(uploadSpeed)}/s`);
            
            this.eventManager?.updateProgress({
              phase: 'upload',
              uploadedBytes: totalBytesUploaded,
              totalUploadBytes,
              percentage,
              uploadSpeed,
              currentFile: `Uploading directory (${this.formatBytes(totalBytesUploaded)}/${this.formatBytes(totalUploadBytes)})`
            });
            
            lastProgressUpdate = now;
          }
        },
        onShardStored: (meta: any) => {
          if (meta && typeof meta.shardIndex === 'number' && typeof meta.totalShards === 'number') {
            const shardSize = totalUploadBytes / meta.totalShards;
            const uploadedBytes = Math.min((meta.shardIndex + 1) * shardSize, totalUploadBytes);
            const percentage = (uploadedBytes / totalUploadBytes) * 100;
            
            console.log(`Debug: Shard ${meta.shardIndex + 1}/${meta.totalShards} stored (${percentage.toFixed(1)}%)`);
            
            this.eventManager?.updateProgress({
              phase: 'upload',
              uploadedBytes,
              totalUploadBytes,
              percentage,
              uploadSpeed,
              currentShardIndex: meta.shardIndex,
              totalShards: meta.totalShards,
              currentFile: `Processing shard ${meta.shardIndex + 1}/${meta.totalShards}`
            });

            // Update total bytes uploaded if shard tracking shows more progress
            if (uploadedBytes > totalBytesUploaded) {
              totalBytesUploaded = uploadedBytes;
              lastBytesUploaded = uploadedBytes;
            }
          }
        },
        fetchWithUploadProgress
      });

      // Step 5: Show completion
      const uploadDuration = (Date.now() - uploadStartTime) / 1000;
      const averageUploadSpeed = uploadDuration > 0 ? totalUploadBytes / uploadDuration : 0;
      
      this.eventManager?.updateProgress({
        phase: 'upload',
        status: 'completed',
        uploadedBytes: totalUploadBytes,
        totalUploadBytes,
        percentage: 100,
        uploadSpeed: averageUploadSpeed,
        currentFile: 'Upload complete!',
        completedFiles: files.length
      });

      console.log(`✅ Directory uploaded successfully! CID: ${directoryCid}`);

      return {
        success: true,
        cid: directoryCid.toString(),
        url: `https://${directoryCid}.ipfs.w3s.link`,
        size: totalUploadBytes,
        status: "success",
      };
    } catch (error) {
      console.error("❌ Error uploading directory to Storacha:", error);
      this.eventManager?.updateProgress({
        phase: 'upload',
        currentFile: 'Upload failed!',
        errors: [{ file: 'directory', error: error as Error }]
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      };
    } finally {
      this.isUploading = false;
    }
  }

  // Helper function for formatting bytes
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  async createNewStorachaSpace(spaceName: string): Promise<SpaceResponse> {
    try {
      console.log(`🚀 Creating new Storacha space: ${spaceName}...`);
      const { client, account } = await this.initializeClient();
      await this.waitForPlanActivation(account);

      const space = (await client.createSpace(spaceName, {
        account,
      } as any)) as Space;
      const did = space.did();
      await client.setCurrentSpace(did as any);
      console.log(
        `✅ New space created and set as current: ${spaceName} (DID: ${did})`
      );

      return {
        success: true,
        did,
        name: spaceName,
      };
    } catch (error) {
      console.error("❌ Error creating new Storacha space:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async connect(config: { email: `${string}@${string}` }): Promise<StorachaClient> {
    const client = new StorachaClient();
    await client.initialize();
    await client.login(config.email);
    return client;
  }

  async disconnect(): Promise<void> {
    this.client = null as any;
    this.account = null;
  }

  async setCurrentSpaceByDID(did: string): Promise<SpaceResponse> {
    try {
      console.log(`🔄 Setting current space to DID: ${did}...`);
      const { account, client } = await this.initializeClient();
      const res = await account.agent.getSpaceInfo();
      console.log(`📍 Current Space: ${res.did}`);
      await client.setCurrentSpace(did as any);
      console.log(`✅ Successfully set current space to: ${did}`);

      return {
        success: true,
        did,
        name: did.split(":").pop() || "",
      };
    } catch (error) {
      console.error("❌ Error setting current space by DID:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAllSpaces(): Promise<SpaceResponse[]> {
    try {
      console.log("🔍 Fetching all spaces...");
      const { client } = await this.initializeClient();
      const spaces = client.spaces();
      console.log(`✅ Found ${spaces.length} spaces.`);

      return spaces.map((space) => ({
        success: true,
        did: space.did(),
        name: space.name,
      }));
    } catch (error) {
      console.error("❌ Error fetching all spaces:", error);
      return [];
    }
  }

  async getAllUploads(): Promise<UploadListItem[]> {
    try {
      console.log("🔍 Fetching all uploads...");
      const { client } = await this.initializeClient();
      const uploads = await client.capability.upload.list();
      console.log(`✅ Found ${uploads.size} uploads.`);

      return uploads.results;
      
    } catch (error) {
      console.error("❌ Error fetching all uploads:", error);
      return [];
    }
  }

  async login(email: `${string}@${string}`): Promise<void> {
    try {
      this.account = await this.client.login(email);
    } catch (error) {
      throw new Error(`Failed to login to Storacha: ${error}`);
    }
  }

  async uploadFilesInBatches(files: FileData[]): Promise<void> {
    const batchSize = 5;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      this.eventManager?.updateProgress({
        phase: 'upload',
        currentFile: `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`
      });
      
      await Promise.all(
        batch.map(file => this.uploadToStoracha(file.buffer, file.fileName))
      );
    }
  }
}
