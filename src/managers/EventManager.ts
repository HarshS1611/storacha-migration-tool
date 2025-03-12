import { EventEmitter } from 'events';
import { MigrationProgress, UploadResponse } from '../types';

export class EventManager extends EventEmitter {
  private progress: MigrationProgress;

  constructor() {
    super();
    this.progress = {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      percentage: 0,
      errors: []
    };
  }

  updateProgress(update: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...update };
    this.emit('progress', this.progress);
  }

  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.on('progress', callback);
  }

  onFileComplete(callback: (fileKey: string, result: UploadResponse) => void): void {
    this.on('fileComplete', callback);
  }

  onError(callback: (error: Error, fileKey?: string) => void): void {
    this.on('error', callback);
  }
} 