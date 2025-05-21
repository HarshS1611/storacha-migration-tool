import React, { useState, useEffect, useCallback } from 'react';
import { ProgressBar } from '../common/ProgressBar';
import { ProcessSteps, ProcessStep } from '../common/ProcessSteps';
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
  email: string;
  space?: string;
  s3Config: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
  };
  s3Path: string;
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

interface MigrationProgress {
  phase: 'idle' | 'downloading' | 'uploading' | 'completed' | 'error';
  message: string;
  percentage: number;
  error?: string;
  timestamp: number;
}

interface UploadResponse {
  success: boolean;
  cid?: string;
  url?: string;
  size?: number;
  error?: string;
}

interface ProcessState {
  steps: ProcessStep[];
  currentStepId: string;
}

export const StorachaUploader: React.FC<StorachaUploaderProps> = ({
  file,
  email,
  space,
  s3Config,
  s3Path,
}) => {
  const [config, setConfig] = useState<StorachaConfig>({
    email,
    space,
  });

  const [progress, setProgress] = useState<MigrationProgress>({
    phase: 'idle',
    message: 'Ready to start migration',
    percentage: 0,
    timestamp: Date.now(),
  });

  const [availableSpaces, setAvailableSpaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrator, setMigrator] = useState<BrowserMigrator | null>(null);

  const [processState, setProcessState] = useState<ProcessState>({
    steps: [
      {
        id: 'initialize',
        title: 'Initialize Storacha Client',
        status: 'pending',
      },
      {
        id: 'authenticate',
        title: 'Authenticate User',
        description: 'Logging in with email',
        status: 'pending',
      },
      {
        id: 'plan-check',
        title: 'Check Payment Plan',
        status: 'pending',
      },
      {
        id: 'space-setup',
        title: 'Set Up Space',
        status: 'pending',
      },
      {
        id: 'upload',
        title: 'Upload File',
        status: 'pending',
      },
      {
        id: 'complete',
        title: 'Complete Migration',
        status: 'pending',
      },
    ],
    currentStepId: ''
  });

  const [error, setError] = useState<string | null>(null);

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

  const updateStep = (stepId: string, status: ProcessStep['status'], description?: string) => {
    setProcessState(prev => ({
      ...prev,
      currentStepId: stepId,
      steps: prev.steps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            status,
            description: description || step.description,
            timestamp: new Date()
          };
        }
        return step;
      })
    }));
  };

  const handleUpload = useCallback(async () => {
    try {
      setProgress({
        phase: 'downloading',
        message: 'Starting migration...',
        percentage: 0,
        timestamp: Date.now(),
      });

      const response = await fetch('/api/storacha-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          space,
          isS3Source: true,
          s3Config,
          s3Path,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const updates = text.split('\n').filter(Boolean);

        for (const update of updates) {
          try {
            const data = JSON.parse(update);
            setProgress({
              phase: data.phase,
              message: data.message,
              percentage: data.percentage,
              error: data.error,
              timestamp: Date.now(),
            });

            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error('Error parsing progress update:', e);
          }
        }
      }
    } catch (error) {
      setProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        percentage: 0,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: Date.now(),
      });
    }
  }, [email, space, s3Config, s3Path]);

  const getProgressColor = () => {
    switch (progress.phase) {
      case 'completed':
        return 'green';
      case 'error':
        return 'red';
      case 'downloading':
      case 'uploading':
        return progress.percentage >= 100 ? 'green' : 'storacha';
      default:
        return 'storacha';
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6 text-storacha">S3 to Storacha Migration</h2>
      
      <form onSubmit={handleUpload} className="space-y-8">
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
            className={`btn btn-primary w-full ${
              progress.phase !== 'idle' && progress.phase !== 'error'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-storacha hover:bg-storacha-600'
            }`}
            disabled={isLoading || !file || progress.phase !== 'idle' && progress.phase !== 'error'}
          >
            {progress.phase === 'idle' ? 'Start Migration' : 'Migration in Progress'}
          </button>
        </div>
      </form>
      
      {progress.phase !== 'idle' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Migration Progress</h3>
            <ProcessSteps 
              steps={processState.steps} 
              currentStep={processState.currentStepId} 
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Migration Status</h3>
            
            <div className="mb-4">
              <p className={`text-sm ${progress.error ? 'text-red-500' : 'text-gray-600'}`}>
                {progress.message}
              </p>
            </div>
            
            <ProgressBar
              progress={progress.percentage}
              color={getProgressColor()}
              showPercentage
            />
            
            {progress.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                {progress.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 