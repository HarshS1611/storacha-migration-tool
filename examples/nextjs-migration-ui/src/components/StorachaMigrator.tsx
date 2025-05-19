import React, { useState, useEffect, useRef } from 'react';
import { ProgressBar } from './common/ProgressBar';
import { formatBytes, formatTime, formatSpeed } from '@/utils/formatters';
import { CustomLogger, LogMessage } from '@/utils/CustomLogger';
import { StorachaMigrator as LibStorachaMigrator } from 'storacha-migration-tool';

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
  };
  migrationOptions: {
    isDirectory: boolean;
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

interface LogEntry extends LogMessage {
  id: string;
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
      email: ''
    },
    migrationOptions: {
      isDirectory: false
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const loggerRef = useRef<CustomLogger>();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [migrationMode, setMigrationMode] = useState<'browser' | 'server'>('browser');

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (logs.length > 0) {
      scrollToBottom();
    }
  }, [logs]);

  useEffect(() => {
    // Initialize logger once
    if (!loggerRef.current) {
      loggerRef.current = new CustomLogger();
    }

    // Subscribe to logger events
    const unsubscribe = loggerRef.current.subscribe((log) => {
      setLogs(prev => [...prev, { ...log, id: crypto.randomUUID() }]);
    });

    // Return the unsubscribe function directly
    return unsubscribe;
  }, []);

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
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setConfig(prev => ({
        ...prev,
        [section]: { ...prev[section as keyof MigrationConfig], [field]: value }
      }));
    } else {
      setConfig(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    const [section, field] = name.split('.');
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof MigrationConfig], [field]: checked }
    }));
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogs([]); // Clear previous logs
    
    if (!validateForm() || !loggerRef.current) {
      return;
    }

    try {
      setIsLoading(true);

      if (migrationMode === 'browser') {
        // Browser approach using the library directly
        loggerRef.current.info("Using the Storacha migration tool directly in the browser");
        
        // Create StorachaMigrator instance with our custom logger
        const migrator = new LibStorachaMigrator({
          s3: {
            region: config.s3.region,
            bucketName: config.s3.bucketName,
            credentials: {
              accessKeyId: config.s3.accessKeyId,
              secretAccessKey: config.s3.secretAccessKey
            }
          },
          storacha: {
            email: config.storacha.email
          },
          retry: {
            maxAttempts: 3,
            backoffMs: 1000,
            maxBackoffMs: 10000
          },
          batch: {
            concurrency: 3,
            size: 5
          }
        }, undefined, loggerRef.current);

        // Initialize the migrator
        await migrator.initialize();

        // Start migration based on whether it's a file or directory
        let result;
        if (config.migrationOptions.isDirectory) {
          loggerRef.current.info(`Migrating directory: ${config.s3.objectKey}`);
          result = await migrator.migrateDirectory(config.s3.objectKey);
        } else {
          loggerRef.current.info(`Migrating file: ${config.s3.objectKey}`);
          result = await migrator.migrateFile(config.s3.objectKey);
        }

        if (!result.success) {
          throw new Error(result.error || 'Migration failed');
        }

        setProgress(prev => ({
          ...prev,
          status: 'completed',
          phase: 'completed',
          message: `Migration completed successfully!\nCID: ${result.cid}\nURL: ${result.url}`,
          percentage: 100,
          cid: result.cid,
          url: result.url
        }));
      } else {
        // Server approach using a server-side API
        loggerRef.current.info("Using the Storacha migration tool via server API");
        
        // Call the server-side API to handle the migration
        const response = await fetch('/api/migrate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: config.migrationOptions.isDirectory ? 'migrateDirectoryToStoracha' : 'migrateFileToStoracha',
            s3Config: {
              region: config.s3.region,
              bucketName: config.s3.bucketName,
              credentials: {
                accessKeyId: config.s3.accessKeyId,
                secretAccessKey: config.s3.secretAccessKey
              }
            },
            pathKey: config.s3.objectKey,
            isDirectory: config.migrationOptions.isDirectory,
            storachaConfig: {
              email: config.storacha.email
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Server-side migration failed');
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || 'Server-side migration failed');
        }

        setProgress(prev => ({
          ...prev,
          status: 'completed',
          phase: 'completed',
          message: `Migration completed successfully!\nCID: ${result.cid}\nURL: ${result.url}`,
          percentage: 100,
          cid: result.cid,
          url: result.url
        }));
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

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info':
        return '📝';
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'debug':
        return '🔍';
      default:
        return '📋';
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'debug':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-white to-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white bg-opacity-20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">S3 to Storacha Migration</h2>
            <p className="text-blue-100 mt-1">Transfer your AWS S3 files to Storacha storage effortlessly</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <form onSubmit={handleMigrate} className="space-y-10">
          {/* Migration Mode Selection */}
          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Migration Mode
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                className={`relative rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${migrationMode === 'browser' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setMigrationMode('browser')}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex items-center h-5">
                      <input
                        id="browser-mode"
                        type="radio"
                        name="migration-mode"
                        checked={migrationMode === 'browser'}
                        onChange={() => setMigrationMode('browser')}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                    </div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-800 mt-4">Browser Migration</h4>
                  <p className="mt-2 text-gray-600">
                    Use Storacha's migration tool directly in the browser. Fast and efficient for most files.
                  </p>
                  <div className="mt-4 text-sm font-medium text-blue-700 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Requires CORS setup
                  </div>
                </div>
              </div>
              
              <div 
                className={`relative rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${migrationMode === 'server' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setMigrationMode('server')}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <div className="flex items-center h-5">
                      <input
                        id="server-mode"
                        type="radio"
                        name="migration-mode"
                        checked={migrationMode === 'server'}
                        onChange={() => setMigrationMode('server')}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                    </div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-800 mt-4">Server-side Migration</h4>
                  <p className="mt-2 text-gray-600">
                    Use Storacha's migration tool on the server. Better for large files and directories.
                  </p>
                  <div className="mt-4 text-sm font-medium text-green-700 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    No CORS required
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* S3 Configuration Section */}
          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                S3 Configuration
              </span>
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      Region <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="s3.region"
                    value={config.s3.region}
                    onChange={handleInputChange}
                    className={`block w-full px-4 py-3 rounded-lg border ${errors.s3?.region ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                    placeholder="e.g., us-east-1"
                  />
                  {errors.s3?.region && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.s3.region}
                    </p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      Bucket Name <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="s3.bucketName"
                    value={config.s3.bucketName}
                    onChange={handleInputChange}
                    className={`block w-full px-4 py-3 rounded-lg border ${errors.s3?.bucketName ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                    placeholder="e.g., my-bucket"
                  />
                  {errors.s3?.bucketName && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.s3.bucketName}
                    </p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      Access Key ID <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="s3.accessKeyId"
                      value={config.s3.accessKeyId}
                      onChange={handleInputChange}
                      className={`block w-full px-4 py-3 rounded-lg border ${errors.s3?.accessKeyId ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                      placeholder="Enter your AWS Access Key ID"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                  </div>
                  {errors.s3?.accessKeyId && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.s3.accessKeyId}
                    </p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      Secret Access Key <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="s3.secretAccessKey"
                      value={config.s3.secretAccessKey}
                      onChange={handleInputChange}
                      className={`block w-full px-4 py-3 rounded-lg border ${errors.s3?.secretAccessKey ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                      placeholder="Enter your AWS Secret Access Key"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                  </div>
                  {errors.s3?.secretAccessKey && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.s3.secretAccessKey}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <span className="flex items-center">
                    S3 Path <span className="text-red-500 ml-1">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  name="s3.objectKey"
                  value={config.s3.objectKey}
                  onChange={handleInputChange}
                  className={`block w-full px-4 py-3 rounded-lg border ${errors.s3?.objectKey ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                  placeholder={config.migrationOptions.isDirectory ? "e.g., my-directory/" : "e.g., path/to/file.txt"}
                />
                {errors.s3?.objectKey && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.s3.objectKey}
                  </p>
                )}
                
                <div className="mt-3 flex items-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      id="isDirectory"
                      type="checkbox"
                      name="migrationOptions.isDirectory"
                      checked={config.migrationOptions.isDirectory}
                      onChange={handleCheckboxChange}
                      className="sr-only"
                    />
                    <div className={`relative w-10 h-5 transition-colors duration-200 ease-in-out rounded-full ${config.migrationOptions.isDirectory ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out transform ${config.migrationOptions.isDirectory ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="ml-3 text-sm text-gray-700">
                      This is a directory
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Storacha Configuration Section */}
          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                Storacha Configuration
              </span>
            </h3>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                <span className="flex items-center">
                  Email <span className="text-red-500 ml-1">*</span>
                </span>
              </label>
              <input
                type="email"
                name="storacha.email"
                value={config.storacha.email}
                onChange={handleInputChange}
                className={`block w-full px-4 py-3 rounded-lg border ${errors.storacha?.email ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200`}
                placeholder="Enter your Storacha email"
              />
              {errors.storacha?.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.storacha.email}
                </p>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {logs.length > 0 && (
            <div className="space-y-5 bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Migration Progress
                </span>
              </h3>
              
              {/* Latest Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {progress.status === 'error' ? 'Failed' : 
                     progress.status === 'completed' ? 'Completed' : 
                     'Migrating...'}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {progress.percentage.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar
                  progress={progress.percentage}
                  color={progress.status === 'error' ? 'red' : 
                         progress.status === 'completed' ? 'green' : 
                         'storacha'}
                  showPercentage={false}
                />
                
                {progress.status === 'completed' && progress.cid && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Migration Completed Successfully
                    </h4>
                    
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-700 font-medium">CID:</span>
                        <code className="text-sm text-green-800 bg-green-100 rounded px-2 py-1">{progress.cid}</code>
                      </div>
                      
                      {progress.url && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-700 font-medium">URL:</span>
                          <a 
                            href={progress.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                          >
                            {progress.url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Logs Timeline */}
              <div className="mt-6">
                <h4 className="text-base font-medium text-gray-700 mb-3">Logs</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto p-4 rounded-lg border border-gray-200 bg-white scroll-smooth">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border-l-4 transition-all duration-200 ${getLogColor(log.level)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg" role="img" aria-label={log.level}>
                            {getLogIcon(log.level)}
                          </span>
                          <span className="font-medium capitalize">{log.level}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-sm whitespace-pre-wrap">
                        {log.message}
                        {log.error && (
                          <div className="mt-1 text-red-600">
                            {log.error.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`
                w-full md:w-auto px-8 py-4 rounded-lg font-medium text-white transition-all duration-200
                ${isValid && !isLoading
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                  : 'bg-gray-300 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Migrating...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Start Migration
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 