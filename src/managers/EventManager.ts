import { EventEmitter } from 'events';
import { MigrationProgress, UploadResponse } from '../types/index.js';

export class EventManager extends EventEmitter {
  private progressCallback?: (progress: MigrationProgress) => void;
  private errorCallback?: (error: Error, fileKey?: string) => void;
  private startTime?: Date;
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
    estimatedTimeRemaining: ''
  };

  private createProgressBar(percentage: number): string {
    const width = 30;
    const completed = Math.floor((width * percentage) / 100);
    const remaining = width - completed;
    return `[${'='.repeat(completed)}${'-'.repeat(remaining)}]`;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private calculateTimeRemaining(): string {
    if (!this.startTime || this.progress.percentage === 0) return 'Calculating...';
    
    const elapsedMs = new Date().getTime() - this.startTime.getTime();
    const totalEstimatedMs = (elapsedMs * 100) / this.progress.percentage;
    const remainingMs = totalEstimatedMs - elapsedMs;
    
    if (remainingMs < 1000) return 'Almost done...';
    
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return `${minutes}m ${seconds}s remaining`;
  }

  constructor() {
    super();
    this.startTime = new Date();
  }

  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.errorCallback = callback;
  }

  updateProgress(update: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...update };
    
    if (this.progress.totalBytes > 0) {
      const fileProgress = (this.progress.completedFiles / this.progress.totalFiles) * 50;
      const byteProgress = (this.progress.bytesUploaded / this.progress.totalBytes) * 50;
      this.progress.percentage = fileProgress + byteProgress;
    } else {
      this.progress.percentage = (this.progress.completedFiles / this.progress.totalFiles) * 100;
    }

    this.progress.estimatedTimeRemaining = this.calculateTimeRemaining();

    const progressInfo = {
      ...this.progress,
      formattedProgress: this.createProgressBar(this.progress.percentage),
      uploadSpeed: this.formatBytes(this.progress.bytesUploaded / ((new Date().getTime() - this.startTime!.getTime()) / 1000)),
      totalSize: this.formatBytes(this.progress.totalBytes),
      uploadedSize: this.formatBytes(this.progress.bytesUploaded)
    };

    this.progressCallback?.(progressInfo as MigrationProgress);
  }

  updateFileProgress(fileKey: string, bytesUploaded: number, totalBytes: number): void {
    this.progress.currentFile = fileKey;
    this.progress.bytesUploaded = bytesUploaded;
    this.progress.totalBytes = totalBytes;
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