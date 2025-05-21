/**
 * Browser-compatible wrapper for StorachaMigrator
 * This wrapper prevents the StorachaMigrator from trying to use Node.js-specific modules in the browser
 */

import { BrowserEventManager } from './BrowserEventManager';

// Define types to match the library
type MigrationProgress = any;
type UploadResponse = any;
type SpaceResponse = any;

// Mock implementations for Node.js modules before any imports happen
// This needs to be executed before the StorachaMigrator is instantiated
// Define shims for Node.js built-ins
if (typeof window !== 'undefined') {
  // We're in a browser environment
  if (!global.process) {
    (global as any).process = { 
      cwd: () => '/',
      env: {},
      version: '',
      versions: {},
      platform: 'browser',
      browser: true
    };
  }

  // Mock fs module
  (global as any).fs = {
    existsSync: () => true,
    mkdirSync: () => {},
    createWriteStream: () => ({
      write: () => {},
      end: () => {},
      on: (_: string, cb: Function) => { cb(); }
    }),
    readFileSync: () => Buffer.from([]),
    writeFileSync: () => {}
  };
  
  // Mock path module
  (global as any).path = {
    join: (...args: string[]) => args.join('/'),
    resolve: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    basename: (p: string) => p.split('/').pop() || p
  };

  // Mock Buffer if needed
  if (!global.Buffer) {
    (global as any).Buffer = {
      from: (data: any) => data,
      isBuffer: () => false
    };
  }
}

// Create a mock StorachaMigrator for simulation when the library can't be loaded
class SimulatedMigrator {
  private options: any;
  private config: any;
  private browserEventManager: BrowserEventManager;

  constructor(config: any, options?: any) {
    this.config = config;
    this.options = options;
    this.browserEventManager = new BrowserEventManager();
  }

  async initialize(): Promise<void> {
    console.log('SimulatedMigrator: initialized');
    return Promise.resolve();
  }

  async close(): Promise<void> {
    console.log('SimulatedMigrator: closed');
    return Promise.resolve();
  }

  async migrateFile(fileKey: string): Promise<UploadResponse> {
    console.log(`SimulatedMigrator: migrateFile(${fileKey})`);
    
    // Simulate a successful upload after a delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          cid: `bafybeic${Math.random().toString(36).slice(2, 11)}`,
          url: `https://w3s.link/ipfs/bafybeic${Math.random().toString(36).slice(2, 11)}`,
          size: 1024 * 1024 * Math.random() * 10 // Random size between 0-10MB
        });
      }, 2000);
    });
  }

  async migrateDirectory(directoryPath: string): Promise<UploadResponse> {
    console.log(`SimulatedMigrator: migrateDirectory(${directoryPath})`);
    
    // Simulate a successful upload after a delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          cid: `bafybeic${Math.random().toString(36).slice(2, 11)}`,
          url: `https://w3s.link/ipfs/bafybeic${Math.random().toString(36).slice(2, 11)}`,
          size: 1024 * 1024 * Math.random() * 50 // Random size between 0-50MB
        });
      }, 3000);
    });
  }

  async createSpace(): Promise<SpaceResponse> {
    console.log('SimulatedMigrator: createSpace()');
    
    // Simulate creating a space
    return Promise.resolve({
      success: true,
      space: {
        did: `did:key:z${Math.random().toString(36).slice(2, 11)}`,
        name: `Space-${new Date().toISOString().slice(0, 10)}`
      }
    });
  }

  async setSpace(did: string): Promise<SpaceResponse> {
    console.log(`SimulatedMigrator: setSpace(${did})`);
    
    // Simulate setting a space
    return Promise.resolve({
      success: true,
      space: {
        did,
        name: `Space-${did.slice(-8)}`
      }
    });
  }

  onProgress(callback: (progress: Partial<MigrationProgress>) => void): void {
    this.browserEventManager.onProgress(callback);
    
    // Simulate some progress events
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress > 100) {
        clearInterval(interval);
        return;
      }
      
      callback({
        status: progress === 100 ? 'completed' : 'uploading',
        phase: progress < 50 ? 'download' : 'upload',
        percentage: progress,
        downloadedBytes: progress < 50 ? (1024 * 1024 * progress) : (1024 * 1024 * 50),
        totalDownloadBytes: 1024 * 1024 * 50,
        uploadedBytes: progress > 50 ? (1024 * 1024 * (progress - 50)) : 0,
        totalUploadBytes: 1024 * 1024 * 50,
        currentFile: 'simulated-file.dat'
      });
    }, 500);
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.browserEventManager.onError(callback);
  }
}

// Try to load the actual StorachaMigrator, fall back to simulation if it fails
let ActualStorachaMigrator: any;
try {
  if (typeof window === 'undefined') {
    // We're in a server environment, we can use the actual module
    const { StorachaMigrator } = require('storacha-migration-tool');
    ActualStorachaMigrator = StorachaMigrator;
  } else {
    // We're in a browser environment, try to load it with special handling
    const { StorachaMigrator } = require('storacha-migration-tool');
    ActualStorachaMigrator = StorachaMigrator;
  }
} catch (error) {
  console.warn('Failed to load StorachaMigrator, using simulation mode:', error);
  ActualStorachaMigrator = SimulatedMigrator;
}

export class BrowserMigrator {
  private migrator: any;
  private browserEventManager: BrowserEventManager;
  private usingSimulation: boolean;

  constructor(config: any, options?: any) {
    this.browserEventManager = new BrowserEventManager();
    this.usingSimulation = !ActualStorachaMigrator || ActualStorachaMigrator === SimulatedMigrator;
    
    try {
      // Create the actual migrator with our options
      this.migrator = new ActualStorachaMigrator(
        {
          ...config,
          // Add any browser-specific overrides here
        }, 
        {
          ...options,
          progressCallback: (progress: Partial<MigrationProgress>) => {
            if (options?.progressCallback) {
              options.progressCallback(progress);
            }
          },
          errorCallback: (error: Error, fileKey?: string) => {
            if (options?.errorCallback) {
              options.errorCallback(error, fileKey);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error creating migrator, falling back to simulation:', error);
      this.usingSimulation = true;
      this.migrator = new SimulatedMigrator(config, options);
    }
    
    if (this.usingSimulation) {
      console.warn('Using simulated StorachaMigrator - operations will not actually perform real migrations');
    }
  }

  async initialize(): Promise<void> {
    try {
      return await this.migrator.initialize();
    } catch (error) {
      console.error("Error initializing StorachaMigrator:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    return this.migrator.close();
  }

  async migrateFile(fileKey: string): Promise<UploadResponse> {
    return this.migrator.migrateFile(fileKey);
  }

  async migrateDirectory(directoryPath: string): Promise<UploadResponse> {
    return this.migrator.migrateDirectory(directoryPath);
  }

  async createSpace(): Promise<SpaceResponse> {
    return this.migrator.createSpace();
  }

  async setSpace(did: string): Promise<SpaceResponse> {
    return this.migrator.setSpace(did);
  }

  onProgress(callback: (progress: Partial<MigrationProgress>) => void): void {
    this.browserEventManager.onProgress(callback);
    this.migrator.onProgress(callback as any);
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.browserEventManager.onError(callback);
    this.migrator.onError(callback);
  }
} 