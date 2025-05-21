import { EventEmitter } from 'events';
import { MigrationProgress, ProgressStatus, TransferProgress, ShardProgress, LogEntry } from '../types/index.js';
import fs from 'fs';
import path from 'path';

export class EventManager extends EventEmitter {
  private progress: MigrationProgress;
  private progressCallback?: (progress: MigrationProgress) => void;
  private errorCallback?: (error: Error) => void;
  private startTime: Date;
  private phaseStartTime: Date;
  private lastUpdateTime: Date;
  private logStream: fs.WriteStream;
  private transferProgress: TransferProgress = {
    bytesTransferred: 0,
    bytesTotal: 0,
    percentage: 0,
    speed: 0,
    estimatedTimeRemaining: 'Calculating...',
    lastUpdate: Date.now(),
    lastDownloadBytes: 0,
    lastUploadBytes: 0,
    downloadBytes: 0,
    uploadBytes: 0,
    downloadSpeed: 0,
    uploadSpeed: 0
  };
  private shardProgress?: ShardProgress;

  private lastBytesProcessed = 0;
  private lastSpeedUpdateTime = Date.now();
  private speedHistory: number[] = [];
  private readonly SPEED_HISTORY_LENGTH = 5; // Keep last 5 speed measurements for averaging

  constructor() {
    super();
    this.progress = this.initializeProgress();
    this.startTime = new Date();
    this.phaseStartTime = new Date();
    this.lastUpdateTime = new Date();
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logStream = fs.createWriteStream(path.join(logsDir, `migration-${timestamp}.log`), { flags: 'a' });
    this.log('Migration started', this.progress);
  }

  private initializeProgress(): MigrationProgress {
    return {
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
      currentShardIndex: 0,
      totalShards: 0,
      errors: []
    };
  }

  private log(message: string, data?: LogEntry['data']): void {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      message,
      data
    };
    this.logStream.write(JSON.stringify(logEntry, null, 2) + '\n');
  }

  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  private createProgressBar(percentage: number): string {
    const width = 30;
    const completed = Math.floor((width * Math.min(percentage, 100)) / 100);
    const remaining = width - completed;
    return `[${'='.repeat(completed)}${'-'.repeat(remaining)}]`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private calculateElapsedTime(): string {
    const elapsedMs = new Date().getTime() - this.startTime.getTime();
    const hours = Math.floor(elapsedMs / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  private calculateTimeRemaining(bytesProcessed: number, totalBytes: number, startTime: Date): string {
    if (bytesProcessed === 0 || totalBytes === 0) return 'Calculating...';
    if (bytesProcessed >= totalBytes) return 'Complete';
    
    const elapsedMs = Math.max(100, new Date().getTime() - startTime.getTime());
    const avgSpeed = this.speedHistory.length > 0 
      ? this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length 
      : bytesProcessed / (elapsedMs / 1000);
    
    if (avgSpeed === 0) return 'Calculating...';

    const remainingBytes = totalBytes - bytesProcessed;
    const remainingSeconds = remainingBytes / avgSpeed;
    
    return this.formatTime(remainingSeconds);
  }

  private formatTime(seconds: number): string {
    if (seconds < 1) return 'Almost done...';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
  }

  private updateTransferProgress(transfer: TransferProgress): void {
    const now = Date.now();
    const timeDiff = (now - transfer.lastUpdate) / 1000;

    if (timeDiff >= 1) { // Update every second
      // Calculate speeds in bytes per second
      if (transfer.downloadBytes > 0) {
        transfer.downloadSpeed = Math.round((transfer.downloadBytes - transfer.lastDownloadBytes) / timeDiff);
      }
      if (transfer.uploadBytes > 0) {
        transfer.uploadSpeed = Math.round((transfer.uploadBytes - transfer.lastUploadBytes) / timeDiff);
      }

      // Update last known values
      transfer.lastDownloadBytes = transfer.downloadBytes;
      transfer.lastUploadBytes = transfer.uploadBytes;
      transfer.lastUpdate = now;

      // Calculate time remaining
      if (transfer.uploadSpeed > 0) {
        const remainingBytes = transfer.bytesTotal - transfer.uploadBytes;
        transfer.estimatedTimeRemaining = this.formatTime(remainingBytes / transfer.uploadSpeed);
      } else {
        transfer.estimatedTimeRemaining = 'Calculating...';
      }
    }
  }

  private updateShardProgress(shard: ShardProgress): void {
    if (shard.totalShards > 0) {
      shard.percentage = (shard.shardIndex / shard.totalShards) * 100;
    }
  }

  updateProgress(update: Partial<MigrationProgress>): void {
    // Ensure status and phase are consistent
    if (update.status === 'completed') {
      update.phase = 'completed';
      update.remainingFiles = 0;
      update.processedBytes = this.progress.totalBytes;
      update.percentage = 100;
      update.bytesUploaded = this.progress.totalBytes;
      update.uploadedSize = this.formatBytes(this.progress.totalBytes);
      update.estimatedTimeRemaining = 'Complete';
      update.downloadSpeed = 0;
      update.uploadSpeed = 0;
    }

    // Update transfer progress
    if (update.transferProgress) {
      this.updateTransferProgress(update.transferProgress);
      update.downloadSpeed = update.transferProgress.downloadSpeed;
      update.uploadSpeed = update.transferProgress.uploadSpeed;
    }

    // Update shard progress if available
    if (update.shardProgress) {
      this.updateShardProgress(update.shardProgress);
    }

    // Calculate overall progress
    if (this.progress.totalBytes > 0) {
      update.percentage = Math.min(100, (this.progress.processedBytes / this.progress.totalBytes) * 100);
    }

    // Update elapsed time
    update.elapsedTime = (Date.now() - this.startTime.getTime()) / 1000;

    // Update progress
    this.progress = { ...this.progress, ...update };

    // Log the progress update
    this.log('Progress Update', this.progress);

    // Call progress callback if registered
    if (this.progressCallback) {
      this.progressCallback(this.progress);
    }
  }

  updateFileProgress(fileKey: string, bytesProcessed: number, totalBytes: number, phase: 'download' | 'upload'): void {
    if (phase === 'download') {
      this.progress.downloadedBytes = bytesProcessed;
      if (this.progress.totalDownloadBytes === 0) {
        this.progress.totalDownloadBytes = totalBytes;
      }
    } else {
      this.progress.uploadedBytes = bytesProcessed;
      if (this.progress.totalUploadBytes === 0) {
        this.progress.totalUploadBytes = totalBytes;
      }
    }
    
    this.progress.currentFile = fileKey;
    this.progress.phase = phase;
    this.updateProgress({});
  }

  updateUploadProgress(status: ProgressStatus): void {
    this.progress.phase = 'upload';
    this.progress.uploadedBytes = status.loaded;
    this.progress.totalUploadBytes = status.total;
    
    if (status.shardIndex !== undefined && status.totalShards !== undefined) {
      const shardPercentage = (status.loaded / status.total) * 100;
      this.shardProgress = {
        shardIndex: status.shardIndex,
        totalShards: status.totalShards,
        bytesUploaded: status.loaded,
        bytesTotal: status.total,
        percentage: shardPercentage
      };
      
      this.progress.currentShardIndex = status.shardIndex;
      this.progress.totalShards = status.totalShards;
      
      // Log shard progress
      this.log(`Shard Progress`, {
        shardIndex: status.shardIndex + 1,
        totalShards: status.totalShards,
        percentage: shardPercentage,
        size: `${this.formatBytes(status.loaded)}/${this.formatBytes(status.total)}`
      });
    }
    
    this.updateProgress({});
  }

  setTotalBytes(downloadBytes: number, uploadBytes: number): void {
    this.progress.totalDownloadBytes = downloadBytes;
    this.progress.totalUploadBytes = uploadBytes;
    this.progress.totalBytes = downloadBytes + uploadBytes;
    this.updateProgress({});
  }

  emit(event: 'fileComplete', fileKey: string, result: any): boolean;
  emit(event: 'error', error: Error, fileKey?: string): boolean;
  emit(event: string, ...args: any[]): boolean {
    switch (event) {
      case 'fileComplete':
        const [fileKey, result] = args;
        this.progress.completedFiles++;
        if (this.progress.completedFiles === this.progress.totalFiles) {
          this.progress.status = 'completed';
          this.progress.phase = 'completed';
          this.progress.percentage = 100;
          this.progress.remainingFiles = 0;
          this.log('Migration completed', { fileKey, result });
        }
        this.log(`File completed: ${fileKey}`, { result });
        this.updateProgress({});
        break;
      case 'error':
        const [error, errorFileKey] = args;
        this.progress.failedFiles++;
        this.progress.status = 'error';
        this.progress.errors.push({ file: errorFileKey || 'unknown', error });
        this.log(`Error processing ${errorFileKey}`, { error });
        console.error(`❌ Error processing ${errorFileKey}: ${error.message}`);
        this.errorCallback?.(error);
        break;
    }
    return true;
  }

  close(): void {
    this.log('Migration session ended');
    this.logStream.end();
  }
}