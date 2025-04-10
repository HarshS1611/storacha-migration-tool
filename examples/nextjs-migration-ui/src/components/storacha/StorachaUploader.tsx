import React, { useState, useEffect } from 'react';
import { ProgressBar } from '../common/ProgressBar';
import { formatBytes, formatTime, formatSpeed } from '@/utils/formatters';
import { BrowserMigrator } from '@/utils/BrowserMigrator';

interface S3File {
  name: string;
  size: number;
  type: string;
  s3?: {
    region: string;
    bucketName: string;
    key: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    }
  }
}

interface StorachaUploaderProps {
  file?: S3File;
}

interface StorachaConfig {
  email: string;
  space?: string;
}

interface ShardProgress {
  shardIndex: number;
  totalShards: number;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  phase?: 'initializing' | 'authenticating' | 'preparing' | 'uploading' | 'finalizing' | 'completed' | 'error';
  phaseMessage?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  shardProgress?: ShardProgress;
  cid?: string;
  url?: string;
  fileName?: string;
}

// Drop the direct import of MigrationProgress, UploadResponse from the library
// to avoid import errors when the library can't be loaded
// Define them locally instead
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

interface UploadResponse {
  success: boolean;
  cid?: string;
  url?: string;
  size?: number;
  error?: string;
}

export const StorachaUploader: React.FC<StorachaUploaderProps> = ({ file }: StorachaUploaderProps) => {
  const [config, setConfig] = useState<StorachaConfig>({
    email: '',
    space: '',
  });

  const [progress, setProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0,
    status: 'idle',
  });

  const [availableSpaces, setAvailableSpaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrator, setMigrator] = useState<BrowserMigrator | null>(null);

  // Initialize migrator and fetch spaces when email changes
  useEffect(() => {
    if (config.email && config.email.includes('@')) {
      fetchAvailableSpaces();
    }
  }, [config.email]);

  const fetchAvailableSpaces = async () => {
    try {
      if (!config.email.includes('@')) return;

      // In a full implementation, we would fetch spaces from the server
      // For now, we'll just set a dummy space
      setAvailableSpaces(['Default Space']);
    } catch (error) {
      console.error('Error fetching spaces:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please download a file from S3 first');
      return;
    }
    
    try {
      // Validate email format with a proper regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!config.email || !emailRegex.test(config.email)) {
        throw new Error('Invalid email format. Email must be in the format user@domain.com');
      }
      
      setIsLoading(true);
      setProgress({
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'uploading',
        phase: 'initializing',
        phaseMessage: 'Preparing upload...',
        startTime: new Date(),
        fileName: file.name
      });

      // If we have S3 metadata, use direct migration
      if (file.s3) {
        const response = await fetch('/api/storacha-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: config.email,
            space: config.space,
            isS3Source: true,
            s3Config: file.s3,
            s3Path: file.s3.key
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        // Handle streaming updates
        const reader = response.body?.getReader();
        let finalResult: UploadResponse | null = null;

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              if (buffer.trim()) {
                try {
                  const lastLine = buffer.split('\n').filter(line => line.trim()).pop();
                  if (lastLine && lastLine.includes('"success":')) {
                    finalResult = JSON.parse(lastLine);
                  }
                } catch (e) {
                  console.error('Error parsing final result:', e);
                }
              }
              break;
            }
            
            const chunk = new TextDecoder().decode(value);
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const update = JSON.parse(line);
                if (update.phase) {
                  setProgress(prev => ({
                    ...prev,
                    phase: update.phase,
                    phaseMessage: update.message,
                    percentage: update.percentage || prev.percentage
                  }));
                }
              } catch (e) {
                console.error('Error parsing progress update:', e);
              }
            }
          }
          
          if (finalResult?.success) {
            handleUploadComplete(finalResult);
          } else {
            throw new Error(finalResult?.error || 'Upload failed');
          }
        }
      } else {
        throw new Error('No S3 metadata found for the file');
      }
    } catch (error) {
      console.error('Error during upload:', error);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        phase: 'error',
        phaseMessage: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to update progress from migration progress
  const updateProgressFromMigration = (migrationProgress: MigrationProgress) => {
    const uploadPercentage = migrationProgress.uploadedBytes && migrationProgress.totalUploadBytes
      ? (migrationProgress.uploadedBytes / migrationProgress.totalUploadBytes) * 100
      : 0;
      
    let shardProgress: ShardProgress | undefined;
    
    if (migrationProgress.currentShardIndex !== undefined && 
        migrationProgress.totalShards !== undefined) {
      const shardTotal = migrationProgress.totalUploadBytes 
        ? migrationProgress.totalUploadBytes / migrationProgress.totalShards 
        : 0;
        
      shardProgress = {
        shardIndex: migrationProgress.currentShardIndex,
        totalShards: migrationProgress.totalShards,
        bytesUploaded: migrationProgress.uploadedBytes || 0,
        bytesTotal: shardTotal,
        percentage: (migrationProgress.currentShardIndex / migrationProgress.totalShards) * 100
      };
    }
    
    setProgress({
      loaded: migrationProgress.uploadedBytes || 0,
      total: migrationProgress.totalUploadBytes || 0,
      percentage: uploadPercentage,
      speed: typeof migrationProgress.uploadSpeed === 'string' 
        ? parseFloat(migrationProgress.uploadSpeed) 
        : (migrationProgress.uploadSpeed || 0),
      timeRemaining: migrationProgress.estimatedTimeRemaining
        ? parseTimeRemaining(migrationProgress.estimatedTimeRemaining)
        : 0,
      status: 'uploading',
      startTime: progress.startTime,
      fileName: migrationProgress.currentFile,
      shardProgress
    });
  };
  
  const handleUploadComplete = (result: UploadResponse) => {
    setProgress(prev => ({
      ...prev,
      loaded: file?.size || 0,
      total: file?.size || 0,
      percentage: 100,
      status: 'completed',
      endTime: new Date(),
      cid: result.cid,
      url: result.url
    }));
    setIsLoading(false);
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
      <h2 className="text-xl font-bold mb-4">Upload to Storacha</h2>
      
      {file ? (
        <div className="mb-4 p-3 bg-storacha-50 border border-storacha-200 rounded-lg">
          <h3 className="text-sm font-medium text-storacha-800">Selected File</h3>
          <p className="text-storacha-700">{file.name} ({formatBytes(file.size)})</p>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800">No File Selected</h3>
          <p className="text-yellow-700">Please download a file from S3 first.</p>
          <ProgressBar
            percentage={0}
            color="storacha"
            height="lg"
          />
        </div>
      )}
      
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Storacha Email
          </label>
          <input
            type="email"
            name="email"
            value={config.email}
            onChange={handleInputChange}
            className="input w-full"
            placeholder="your.email@example.com"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            we will validate your email and subsciption status
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Space (Optional)
          </label>
          <select
            name="space"
            value={config.space}
            onChange={handleInputChange}
            className="input w-full"
          >
            <option value="">-- Use Default Space --</option>
            {availableSpaces.map((space: string) => (
              <option key={space} value={space}>
                {space}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            If no space is selected, the default space will be used.
          </p>
        </div>
        
        <div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading || !file}
          >
            {isLoading ? 'Uploading...' : 'Upload to Storacha'}
          </button>
        </div>
      </form>
      
      {progress.status !== 'idle' && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Upload Progress</h3>
          
          {progress.phase && (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 
                  ${progress.phase === 'error' ? 'bg-red-100 text-red-600' : 
                    progress.phase === 'completed' ? 'bg-green-100 text-green-600' : 
                    'bg-storacha-100 text-storacha-600'}`}>
                  {progress.phase === 'initializing' && '🛠️'}
                  {progress.phase === 'authenticating' && '🔑'}
                  {progress.phase === 'preparing' && '⏳'}
                  {progress.phase === 'uploading' && '📤'}
                  {progress.phase === 'finalizing' && '✅'}
                  {progress.phase === 'completed' && '✓'}
                  {progress.phase === 'error' && '❌'}
                </div>
                <span className="font-medium">
                  {progress.phase === 'initializing' && 'Initializing'}
                  {progress.phase === 'authenticating' && 'Authenticating'}
                  {progress.phase === 'preparing' && 'Preparing'}
                  {progress.phase === 'uploading' && 'Uploading'}
                  {progress.phase === 'finalizing' && 'Finalizing'}
                  {progress.phase === 'completed' && 'Completed'}
                  {progress.phase === 'error' && 'Error'}
                </span>
              </div>
              {progress.phaseMessage && (
                <p className="text-sm text-gray-600 ml-10">{progress.phaseMessage}</p>
              )}
            </div>
          )}
          
          <ProgressBar
            percentage={progress.percentage}
            color={
              progress.status === 'error'
                ? 'red'
                : progress.status === 'completed'
                  ? 'green'
                  : 'storacha'
            }
            height="lg"
          />
          
          {progress.shardProgress && (
            <div className="mt-2">
              <ProgressBar 
                percentage={progress.shardProgress.percentage} 
                color="storacha"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700">File Size</h4>
              <p className="text-lg font-semibold">
                {formatBytes(progress.total)}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Uploaded</h4>
              <p className="text-lg font-semibold">
                {formatBytes(progress.loaded)} ({progress.percentage.toFixed(1)}%)
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Upload Speed</h4>
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
            
            {progress.shardProgress && (
              <>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Current Shard</h4>
                  <p className="text-lg font-semibold">
                    {progress.shardProgress.shardIndex + 1} of {progress.shardProgress.totalShards}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Shard Size</h4>
                  <p className="text-lg font-semibold">
                    {formatBytes(progress.shardProgress.bytesTotal)}
                  </p>
                </div>
              </>
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
              <p className="text-green-700 mb-2">
                File uploaded successfully to Storacha!
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-800 w-20">CID:</span>
                  <code className="bg-green-100 px-2 py-1 rounded text-green-800 text-sm flex-1 overflow-x-auto">
                    {progress.cid}
                  </code>
                </div>
                
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-800 w-20">URL:</span>
                  <a 
                    href={progress.url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm overflow-x-auto"
                  >
                    {progress.url}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 