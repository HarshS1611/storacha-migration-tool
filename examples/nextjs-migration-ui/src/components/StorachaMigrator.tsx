import React, { useState, useEffect } from 'react';
import { ProgressBar } from './common/ProgressBar';
import { formatBytes, formatTime, formatSpeed } from '@/utils/formatters';

interface MigrationConfig {
  s3: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    objectKey: string;
  };
  storacha: {
    email: string;
    space?: string;
  };
}

interface FormErrors {
  s3?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    objectKey?: string;
  };
  storacha?: {
    email?: string;
    space?: string;
  };
}

interface MigrationProgress {
  phase?: 'initializing' | 'preparing' | 'migrating' | 'completed' | 'error';
  status: 'idle' | 'migrating' | 'completed' | 'error';
  percentage: number;
  loaded: number;
  total: number;
  speed: number;
  timeRemaining: number;
  fileName?: string;
  message?: string;
  error?: string;
  cid?: string;
  url?: string;
}

export const StorachaMigrator: React.FC = () => {
  const [config, setConfig] = useState<MigrationConfig>({
    s3: {
      region: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      objectKey: ''
    },
    storacha: {
      email: '',
      space: ''
    }
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isValid, setIsValid] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress>({
    status: 'idle',
    percentage: 0,
    loaded: 0,
    total: 0,
    speed: 0,
    timeRemaining: 0
  });

  const [isLoading, setIsLoading] = useState(false);

  // Validate form data
  const validateForm = () => {
    const newErrors: FormErrors = {};
    let isFormValid = true;

    // S3 Validation
    if (!config.s3.region) {
      newErrors.s3 = { ...newErrors.s3, region: 'Region is required' };
      isFormValid = false;
    }
    if (!config.s3.accessKeyId) {
      newErrors.s3 = { ...newErrors.s3, accessKeyId: 'Access Key ID is required' };
      isFormValid = false;
    }
    if (!config.s3.secretAccessKey) {
      newErrors.s3 = { ...newErrors.s3, secretAccessKey: 'Secret Access Key is required' };
      isFormValid = false;
    }
    if (!config.s3.bucketName) {
      newErrors.s3 = { ...newErrors.s3, bucketName: 'Bucket Name is required' };
      isFormValid = false;
    }
    if (!config.s3.objectKey) {
      newErrors.s3 = { ...newErrors.s3, objectKey: 'Object Key is required' };
      isFormValid = false;
    }

    // Storacha Validation
    if (!config.storacha.email) {
      newErrors.storacha = { ...newErrors.storacha, email: 'Email is required' };
      isFormValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.storacha.email)) {
      newErrors.storacha = { ...newErrors.storacha, email: 'Invalid email format' };
      isFormValid = false;
    }

    setErrors(newErrors);
    setIsValid(isFormValid);
    return isFormValid;
  };

  useEffect(() => {
    validateForm();
  }, [config]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const [section, field] = name.split('.');
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof MigrationConfig], [field]: value }
    }));
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setProgress({
        ...progress,
        status: 'migrating',
        phase: 'initializing',
        message: 'Starting migration...',
        percentage: 0
      });

      const response = await fetch('/api/storacha-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isS3Source: true,
          s3Config: {
            region: config.s3.region,
            bucketName: config.s3.bucketName,
            credentials: {
              accessKeyId: config.s3.accessKeyId,
              secretAccessKey: config.s3.secretAccessKey
            }
          },
          s3Path: config.s3.objectKey,
          email: config.storacha.email,
          space: config.storacha.space
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Migration failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unable to read response stream');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
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
                message: update.message,
                percentage: update.percentage || prev.percentage,
                status: update.phase === 'completed' ? 'completed' : 
                        update.phase === 'error' ? 'error' : 'migrating',
                cid: update.cid,
                url: update.url
              }));
            }
          } catch (e) {
            console.error('Error parsing progress update:', e);
          }
        }
      }
    } catch (error) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        phase: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-storacha">S3 to Storacha Migration</h2>
      
      <form onSubmit={handleMigrate} className="space-y-8">
        {/* S3 Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">S3 Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="s3.region"
                value={config.s3.region}
                onChange={handleInputChange}
                className={`input w-full ${errors.s3?.region ? 'border-red-500' : ''}`}
                placeholder="e.g., us-east-1"
              />
              {errors.s3?.region && (
                <p className="mt-1 text-sm text-red-500">{errors.s3.region}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bucket Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="s3.bucketName"
                value={config.s3.bucketName}
                onChange={handleInputChange}
                className={`input w-full ${errors.s3?.bucketName ? 'border-red-500' : ''}`}
                placeholder="e.g., my-bucket"
              />
              {errors.s3?.bucketName && (
                <p className="mt-1 text-sm text-red-500">{errors.s3.bucketName}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Key ID <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="s3.accessKeyId"
                value={config.s3.accessKeyId}
                onChange={handleInputChange}
                className={`input w-full ${errors.s3?.accessKeyId ? 'border-red-500' : ''}`}
                placeholder="Enter your AWS Access Key ID"
              />
              {errors.s3?.accessKeyId && (
                <p className="mt-1 text-sm text-red-500">{errors.s3.accessKeyId}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret Access Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="s3.secretAccessKey"
                value={config.s3.secretAccessKey}
                onChange={handleInputChange}
                className={`input w-full ${errors.s3?.secretAccessKey ? 'border-red-500' : ''}`}
                placeholder="Enter your AWS Secret Access Key"
              />
              {errors.s3?.secretAccessKey && (
                <p className="mt-1 text-sm text-red-500">{errors.s3.secretAccessKey}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Object Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="s3.objectKey"
                value={config.s3.objectKey}
                onChange={handleInputChange}
                className={`input w-full ${errors.s3?.objectKey ? 'border-red-500' : ''}`}
                placeholder="e.g., path/to/file.txt"
              />
              {errors.s3?.objectKey && (
                <p className="mt-1 text-sm text-red-500">{errors.s3.objectKey}</p>
              )}
            </div>
          </div>
        </div>

        {/* Storacha Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Storacha Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="storacha.email"
                value={config.storacha.email}
                onChange={handleInputChange}
                className={`input w-full ${errors.storacha?.email ? 'border-red-500' : ''}`}
                placeholder="Enter your Storacha email"
              />
              {errors.storacha?.email && (
                <p className="mt-1 text-sm text-red-500">{errors.storacha.email}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Space Name <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                name="storacha.space"
                value={config.storacha.space}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter space name (optional)"
              />
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {progress.status !== 'idle' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Migration Progress</h3>
            <div className="space-y-4">
              <ProgressBar
                percentage={progress.percentage}
                color={
                  progress.status === 'completed' ? 'green' :
                  progress.status === 'error' ? 'red' :
                  'storacha'
                }
              />
              {progress.message && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">{progress.message}</pre>
                </div>
              )}
              {progress.error && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-700">{progress.error}</p>
                </div>
              )}
              {progress.cid && (
                <div className="bg-green-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-green-700">Migration Successful!</p>
                  <p className="text-sm text-green-600">CID: {progress.cid}</p>
                  {progress.url && (
                    <a
                      href={progress.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-storacha hover:underline"
                    >
                      View File →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className={`
              px-6 py-2 rounded-lg font-medium text-white
              ${isValid && !isLoading
                ? 'bg-storacha hover:bg-storacha-600 focus:ring-2 focus:ring-storacha-500 focus:ring-offset-2'
                : 'bg-gray-300 cursor-not-allowed'
              }
              transition-colors duration-200
            `}
          >
            {isLoading ? 'Migrating...' : 'Start Migration'}
          </button>
        </div>
      </form>
    </div>
  );
}; 