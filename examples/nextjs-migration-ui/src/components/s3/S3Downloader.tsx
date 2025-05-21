import React, { useState } from 'react';
import { ProgressBar } from '../common/ProgressBar';
import { formatBytes, formatTime, formatSpeed } from '@/utils/formatters';

// Define local interfaces instead of importing from the library
interface MigrationProgress {
  status?: 'idle' | 'uploading' | 'completed' | 'error' | 'downloading' | 'preparing';
  phase?: 'download' | 'upload' | 'preparing' | 'completed';
  percentage?: number;
  downloadedBytes?: number;
  totalDownloadBytes?: number;
  uploadedBytes?: number;
  totalUploadBytes?: number;
  currentFile?: string;
  currentShardIndex?: number;
  totalShards?: number;
  downloadSpeed?: number | string;
  uploadSpeed?: number | string;
  estimatedTimeRemaining?: string;
  [key: string]: any;
}

interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  objectKey: string;
}

interface S3File {
  name: string;
  size: number;
  type: string;
  s3: {
    region: string;
    bucketName: string;
    key: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    }
  }
}

interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  error?: string;
  startTime?: Date;
  endTime?: Date;
  fileName?: string;
}

interface S3DownloaderProps {
  onFileDownload: (file: S3File) => void;
}

export const S3Downloader: React.FC<S3DownloaderProps> = ({ onFileDownload }: S3DownloaderProps) => {
  const [config, setConfig] = useState<S3Config>({
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    objectKey: '',
  });

  const [progress, setProgress] = useState<DownloadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0,
    status: 'idle',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setProgress({
        loaded: 0,
        total: 0,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'downloading',
        startTime: new Date(),
      });

      // Simulate download progress while actual download happens on server
      // This is for UX purposes only - actual progress tracking would be better in a real app
      const simulateProgress = () => {
        const estimatedSize = 5 * 1024 * 1024; // Assume 5MB for simulation
        const simulationDuration = 3000; // 3 seconds for simulation
        const intervalTime = 100; // Update every 100ms
        const steps = simulationDuration / intervalTime;
        let currentStep = 0;
        
        const interval = setInterval(() => {
          currentStep++;
          const percentage = Math.min(95, (currentStep / steps) * 100);
          setProgress(prev => ({
            ...prev,
            loaded: Math.floor((estimatedSize * percentage) / 100),
            total: estimatedSize,
            percentage: percentage,
            speed: (estimatedSize / simulationDuration) * 1000, // bytes per second
            timeRemaining: ((steps - currentStep) * intervalTime) / 1000 // seconds
          }));
          
          if (currentStep >= steps) {
            clearInterval(interval);
          }
        }, intervalTime);
        
        return interval;
      };
      
      const progressInterval = simulateProgress();

      // Call the server-side API to handle the migration
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'downloadFromS3',
          s3Config: {
            region: config.region,
            bucketName: config.bucketName,
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey
            }
          },
          fileKey: config.objectKey
        }),
      });

      // Clear the simulation interval
      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download file');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to download file');
      }

      // Create a virtual file with the S3 metadata
      const file: S3File = {
        name: config.objectKey.split('/').pop() || 'downloaded-file',
        size: result.size,
        type: result.contentType || 'application/octet-stream',
        s3: {
          region: config.region,
          bucketName: config.bucketName,
          key: config.objectKey,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
          }
        }
      };

      setProgress(prev => ({
        ...prev,
        status: 'completed',
        percentage: 100,
        loaded: result.size,
        total: result.size,
        endTime: new Date(),
        fileName: file.name
      }));

      // Call the callback with the file metadata
      onFileDownload(file);
    } catch (error) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to parse time remaining string into seconds
  const parseTimeRemaining = (timeString: string): number => {
    if (timeString === 'Complete') return 0;
    if (timeString === 'Calculating...') return 0;
    
    let seconds = 0;
    
    // Parse minutes:seconds format
    const match = timeString.match(/(\d+):(\d+)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const secs = parseInt(match[2]);
      seconds = minutes * 60 + secs;
    }
    
    return seconds;
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Download from S3</h2>
      
      <form onSubmit={handleDownload} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <input
              type="text"
              name="region"
              value={config.region}
              onChange={handleInputChange}
              className="input w-full"
              placeholder="e.g., us-east-1"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bucket Name
            </label>
            <input
              type="text"
              name="bucketName"
              value={config.bucketName}
              onChange={handleInputChange}
              className="input w-full"
              placeholder="e.g., my-bucket"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Key ID
            </label>
            <input
              type="text"
              name="accessKeyId"
              value={config.accessKeyId}
              onChange={handleInputChange}
              className="input w-full"
              placeholder="Your AWS Access Key ID"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret Access Key
            </label>
            <input
              type="password"
              name="secretAccessKey"
              value={config.secretAccessKey}
              onChange={handleInputChange}
              className="input w-full"
              placeholder="Your AWS Secret Access Key"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Object Key
            </label>
            <input
              type="text"
              name="objectKey"
              value={config.objectKey}
              onChange={handleInputChange}
              className="input w-full"
              placeholder="e.g., path/to/file.jpg"
              required
            />
          </div>
        </div>
        
        <div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Downloading...' : 'Download from S3'}
          </button>
        </div>
      </form>
      
      {progress.status !== 'idle' && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Download Progress</h3>
          
          <ProgressBar
            progress={progress.percentage}
            color={
              progress.status === 'error'
                ? 'red'
                : progress.status === 'completed'
                ? 'green'
                : 'storacha'
            }
            showPercentage
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700">File Size</h4>
              <p className="text-lg font-semibold">
                {formatBytes(progress.total)}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Downloaded</h4>
              <p className="text-lg font-semibold">
                {formatBytes(progress.loaded)} ({progress.percentage.toFixed(1)}%)
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Download Speed</h4>
              <p className="text-lg font-semibold">
                {formatSpeed(progress.speed)}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Time Remaining</h4>
              <p className="text-lg font-semibold">
                {progress.status === 'completed' 
                  ? 'Completed' 
                  : formatTime(progress.timeRemaining)}
              </p>
            </div>
            
            {progress.fileName && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-700">Current File</h4>
                <p className="text-lg font-semibold text-ellipsis overflow-hidden">
                  {progress.fileName}
                </p>
              </div>
            )}
          </div>
          
          {progress.status === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800">Error</h4>
              <p className="text-red-700">{progress.error}</p>
            </div>
          )}
          
          {progress.status === 'completed' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-medium text-green-800">Success</h4>
              <p className="text-green-700">
                File downloaded successfully! Ready to upload to Storacha.
              </p>
              {progress.fileName && (
                <p className="text-sm text-green-700 mt-1">
                  <span className="font-medium">Filename:</span> {progress.fileName}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 