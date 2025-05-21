/**
 * Browser-compatible EventManager for the Storacha Migration Tool
 * This is a simplified version of the EventManager that works in the browser
 * without requiring Node.js fs module for logging
 */

import { EventEmitter } from 'events';
import type { MigrationProgress } from 'storacha-migration-tool';

export class BrowserEventManager extends EventEmitter {
  private progress: Partial<MigrationProgress>;
  private progressCallback?: (progress: Partial<MigrationProgress>) => void;
  private errorCallback?: (error: Error, fileKey?: string) => void;
  private startTime: Date;

  constructor() {
    super();
    this.startTime = new Date();
    this.progress = {
      status: 'preparing',
      phase: 'preparing',
      percentage: 0,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      remainingFiles: 0,
      elapsedTime: 0,
      totalBytes: 0,
      processedBytes: 0,
      bytesUploaded: 0,
      uploadedSize: '0 B',
      downloadSpeed: 0,
      uploadSpeed: 0,
      estimatedTimeRemaining: 'Calculating...',
      downloadedBytes: 0,
      totalDownloadBytes: 0,
      uploadedBytes: 0,
      totalUploadBytes: 0,
      errors: []
    };
  }

  onProgress(callback: (progress: Partial<MigrationProgress>) => void): void {
    this.progressCallback = callback;
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.errorCallback = callback;
  }

  updateProgress(update: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...update };
    if (this.progressCallback) {
      this.progressCallback(this.progress);
    }
  }

  updateFileProgress(fileKey: string, bytesProcessed: number, totalBytes: number, phase: 'download' | 'upload'): void {
    // Update progress based on phase
    if (phase === 'download') {
      this.progress.downloadedBytes = bytesProcessed;
      this.progress.totalDownloadBytes = totalBytes;
    } else {
      this.progress.uploadedBytes = bytesProcessed;
      this.progress.totalUploadBytes = totalBytes;
    }
    
    this.updateProgress(this.progress);
  }

  updateUploadProgress(status: {
    loaded?: number;
    total?: number;
    phase?: string;
    shardIndex?: number;
    totalShards?: number;
    currentFile?: string;
  }): void {
    this.updateProgress({
      uploadedBytes: status.loaded || 0,
      totalUploadBytes: status.total || 0,
      phase: status.phase as any,
      currentShardIndex: status.shardIndex,
      totalShards: status.totalShards,
      currentFile: status.currentFile
    });
  }

  // Custom override to make TypeScript happy with our event emitter
  override emit(eventName: string | symbol, ...args: any[]): boolean {
    if (eventName === 'error' && this.errorCallback && args.length > 0) {
      this.errorCallback(args[0], args[1]);
    }
    return super.emit(eventName, ...args);
  }

  close(): void {
    // No file streams to close in browser
    // Just remove all listeners to prevent memory leaks
    this.removeAllListeners();
  }
} 