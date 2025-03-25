import { EventEmitter } from 'events';
import { MigrationProgress, UploadResponse, ProgressStatus } from '../types/index.js';

export class EventManager extends EventEmitter {
  private progressCallback?: (progress: MigrationProgress) => void;
  private errorCallback?: (error: Error, fileKey?: string) => void;
  private startTime?: Date;
  private phaseStartTime?: Date;
  private progress: MigrationProgress = {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    percentage: 0,
    errors: [],
    currentFile: undefined,
    bytesUploaded: 0,
    totalBytes: 0,
    startTime: new Date(),
    estimatedTimeRemaining: 'Calculating...',
    phase: 'preparing',
    downloadProgress: 0,
    uploadProgress: 0,
    downloadSpeed: '0 B/s',
    uploadSpeed: '0 B/s',
    formattedProgress: '',
    downloadBar: '',
    uploadBar: '',
    totalSize: '0 B',
    uploadedSize: '0 B',
    downloadedBytes: 0,
    uploadedBytes: 0,
    totalDownloadBytes: 0,
    totalUploadBytes: 0
  };

  private createProgressBar(percentage: number): string {
    const width = 30;
    const completed = Math.floor((width * percentage) / 100);
    const remaining = width - completed;
    return `[${'='.repeat(completed)}${'-'.repeat(remaining)}]`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private calculateTimeRemaining(bytesProcessed: number, totalBytes: number, startTime: Date): string {
    if (bytesProcessed === 0) return 'Calculating...';
    
    const elapsedMs = new Date().getTime() - startTime.getTime();
    const bytesPerMs = bytesProcessed / elapsedMs;
    const remainingBytes = totalBytes - bytesProcessed;
    const remainingMs = remainingBytes / bytesPerMs;
    
    if (remainingMs < 1000) return 'Almost done...';
    
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return `${minutes}m ${seconds}s remaining`;
  }

  private calculatePhaseProgress(phase: 'download' | 'upload'): string {
    const progress = phase === 'download' 
      ? (this.progress.downloadedBytes / (this.progress.totalDownloadBytes || 1)) * 100
      : (this.progress.uploadedBytes / (this.progress.totalUploadBytes || 1)) * 100;
    return this.createProgressBar(progress);
  }

  private calculateSpeed(bytes: number, startTime: Date): string {
    const elapsedSeconds = Math.max(1, (new Date().getTime() - startTime.getTime()) / 1000);
    const speed = bytes / elapsedSeconds;
    return `${this.formatBytes(speed)}/s`;
  }

  constructor() {
    super();
    this.startTime = new Date();
    this.phaseStartTime = new Date();
  }

  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.errorCallback = callback;
  }

  updateProgress(update: Partial<MigrationProgress>): void {
    const prevPhase = this.progress.phase;
    const newPhase = update.phase || this.progress.phase;
    
    // Reset phase timer if phase changed
    if (prevPhase !== newPhase) {
      this.phaseStartTime = new Date();
    }
    
    this.progress = { 
      ...this.progress, 
      ...update
    };
    
    // Calculate phase-specific progress
    if (this.progress.phase === 'download') {
      this.progress.downloadProgress = (this.progress.downloadedBytes / (this.progress.totalDownloadBytes || 1)) * 100;
      this.progress.downloadSpeed = this.calculateSpeed(this.progress.downloadedBytes, this.phaseStartTime!);
      this.progress.estimatedTimeRemaining = this.calculateTimeRemaining(
        this.progress.downloadedBytes,
        this.progress.totalDownloadBytes,
        this.phaseStartTime!
      );
    } else if (this.progress.phase === 'upload') {
      this.progress.uploadProgress = (this.progress.uploadedBytes / (this.progress.totalUploadBytes || 1)) * 100;
      this.progress.uploadSpeed = this.calculateSpeed(this.progress.uploadedBytes, this.phaseStartTime!);
      this.progress.estimatedTimeRemaining = this.calculateTimeRemaining(
        this.progress.uploadedBytes,
        this.progress.totalUploadBytes,
        this.phaseStartTime!
      );
    }

    // Overall progress is weighted average of download and upload phases
    const downloadWeight = this.progress.totalDownloadBytes / (this.progress.totalDownloadBytes + this.progress.totalUploadBytes);
    const uploadWeight = this.progress.totalUploadBytes / (this.progress.totalDownloadBytes + this.progress.totalUploadBytes);
    
    this.progress.percentage = (
      (this.progress.downloadProgress * downloadWeight) +
      (this.progress.uploadProgress * uploadWeight)
    );

    const progressInfo = {
      ...this.progress,
      formattedProgress: this.createProgressBar(this.progress.percentage),
      downloadBar: this.calculatePhaseProgress('download'),
      uploadBar: this.calculatePhaseProgress('upload'),
      totalSize: this.formatBytes(this.progress.totalBytes),
      uploadedSize: this.formatBytes(this.progress.bytesUploaded)
    };

    this.progressCallback?.(progressInfo as MigrationProgress);
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
      this.progress.currentShardIndex = status.shardIndex;
      this.progress.totalShards = status.totalShards;
    }
    this.updateProgress({});
  }

  setTotalBytes(downloadBytes: number, uploadBytes: number): void {
    this.progress.totalDownloadBytes = downloadBytes;
    this.progress.totalUploadBytes = uploadBytes;
    this.updateProgress({});
  }

  emit(event: 'fileComplete', fileKey: string, result: any): boolean;
  emit(event: 'error', error: Error, fileKey?: string): boolean;
  emit(event: string, ...args: any[]): boolean {
    switch (event) {
      case 'fileComplete':
        const [fileKey, result] = args;
        this.progress.completedFiles++;
        console.log(`✅ Completed: ${fileKey}`);
        this.updateProgress({});
        break;
      case 'error':
        const [error, errorFileKey] = args;
        this.progress.failedFiles++;
        this.progress.errors.push({ file: errorFileKey || 'unknown', error });
        console.error(`❌ Error processing ${errorFileKey}: ${error.message}`);
        this.errorCallback?.(error, errorFileKey);
        break;
    }
    return true;
  }
} 