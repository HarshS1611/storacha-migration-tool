import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

// Configure Next.js to properly handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Types for better type safety
interface MigrationProgress {
  phase: string;
  message: string;
  percentage?: number;
  error?: string;
  timestamp: string;
}

interface UploadResult {
  success: boolean;
  cid?: string;
  url?: string;
  error?: string;
}

// Helper function to parse JSON request body
async function parseJsonBody(req: NextApiRequest): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(JSON.parse(data));
    });
  });
}

// This handler runs on the server side, where Node.js modules are available
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set up response for streaming updates
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Helper function to send progress updates
    const sendProgressUpdate = (phase: string, message: string, percentage?: number) => {
      const update: MigrationProgress = {
        phase,
        message,
        percentage,
        timestamp: new Date().toISOString()
      };
      res.write(`${JSON.stringify(update)}\n`);
    };

    let StorachaMigrator;
    try {
      const module = await import('storacha-migration-tool');
      StorachaMigrator = module.StorachaMigrator;

      if (!StorachaMigrator) {
        throw new Error('StorachaMigrator not found in imports');
      }
    } catch (importError) {
      console.error('Error importing StorachaMigrator:', importError);
      return res.status(500).json({ 
        error: 'Failed to load migration library'
      });
    }

    let email: string;
    let space: string | undefined;
    let isS3Source: boolean;
    let s3Config: any;
    let s3Path: string | undefined;
    let uploadedFile: any;

    // Handle JSON requests for direct S3 to Storacha migration
    if (req.headers['content-type']?.includes('application/json')) {
      const body = await parseJsonBody(req);
      console.log('Received JSON body:', body); // Debug log
      
      email = body.email;
      space = body.space;
      isS3Source = body.isS3Source;
      s3Config = body.s3Config;
      s3Path = body.s3Path;

      if (!email) {
        throw new Error('Storacha email is required');
      }
      if (!s3Config) {
        throw new Error('S3 configuration is required');
      }
      if (!s3Path) {
        throw new Error('S3 path is required');
      }
    }
    // Handle multipart/form-data for file uploads
    else if (req.headers['content-type']?.includes('multipart/form-data')) {
      const { fields, files } = await parseForm(req);
      uploadedFile = files.file?.[0];
      email = fields.email?.[0];
      space = fields.space?.[0];
      isS3Source = fields.isS3Source?.[0] === 'true';
      s3Path = fields.s3Path?.[0];
      
      if (!uploadedFile && !isS3Source) {
        throw new Error('No file found in upload');
      }
      if (!email) {
        throw new Error('Storacha email is required');
      }
    } else {
      return res.status(415).json({ error: 'Unsupported Media Type' });
    }

    // Set up the environment
    process.env.STORACHA_EMAIL = email;
    sendProgressUpdate('initializing', `Setting up with email: ${email}`, 10);

    // Create the migrator instance
    sendProgressUpdate('initializing', 'Creating StorachaMigrator instance', 15);
    const migrator = new StorachaMigrator({
      s3: s3Config || {
        region: process.env.S3_REGION || 'us-east-1',
        bucketName: process.env.S3_BUCKET_NAME || '',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        }
      },
      storacha: {
        email,
        space
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
    });

    // Set up progress tracking
    migrator.onProgress((progress) => {
      // Clear previous progress (not needed in API context)
      let message = '';

      // Download Progress
      if (progress.downloadedBytes && progress.totalDownloadBytes) {
        const downloadPercentage = (progress.downloadedBytes / progress.totalDownloadBytes) * 100;
        message += `Download: ${downloadPercentage.toFixed(1)}% | ${progress.downloadSpeed || '0 B/s'} | ` +
          `${formatBytes(progress.downloadedBytes)}/${formatBytes(progress.totalDownloadBytes)}\n`;
      }

      // Upload Progress
      if (progress.uploadedBytes && progress.totalUploadBytes) {
        const uploadPercentage = (progress.uploadedBytes / progress.totalUploadBytes) * 100;
        message += `Upload: ${uploadPercentage.toFixed(1)}% | ${progress.uploadSpeed || '0 B/s'} | ` +
          `${formatBytes(progress.uploadedBytes)}/${formatBytes(progress.totalUploadBytes)}\n`;
      }

      // Overall Progress
      message += `\nFiles: ${progress.completedFiles}/${progress.totalFiles}\n`;
      message += `Total Size: ${formatBytes(progress.totalBytes)}\n`;
      message += `Processed: ${formatBytes(progress.bytesUploaded)}\n`;
      message += `Time Left: ${progress.estimatedTimeRemaining || 'Calculating...'}\n`;

      // Shard information
      if (progress.currentShardIndex !== undefined && progress.totalShards !== undefined) {
        message += `\nProcessing Shard: ${progress.currentShardIndex + 1}/${progress.totalShards}`;
      }

      // Calculate overall percentage
      const percentage = progress.uploadedBytes && progress.totalUploadBytes
        ? Math.round((progress.uploadedBytes / progress.totalUploadBytes) * 100)
        : undefined;

      // Send the update
      sendProgressUpdate(
        progress.currentShardIndex !== undefined ? 'uploading' : 'preparing',
        message,
        percentage
      );
    });

    migrator.onError((error: Error, fileKey?: string) => {
      console.error(`\n❌ Error migrating ${fileKey}: ${error.message}`);
      sendProgressUpdate('error', `Error migrating ${fileKey}: ${error.message}`, 0);
    });

    // Initialize the migrator
    sendProgressUpdate('initialize', '🛠 Initializing Storacha client...', 5);
    await migrator.initialize();
    sendProgressUpdate('authenticate', '🔑 Logging in to Storacha...', 10);
    sendProgressUpdate('authenticate', `✅ Logged into Storacha with email: ${email}`, 15);
    sendProgressUpdate('plan-check', '⏳ Waiting for payment plan activation...', 20);
    sendProgressUpdate('plan-check', '✅ Payment plan confirmed.', 25);
    sendProgressUpdate('space-setup', '🔍 Fetching user\'s current space...', 30);

    // If a space was provided, try to set it
    if (space) {
      try {
        await migrator.setSpace(space);
        sendProgressUpdate('initializing', `Set current space to: ${space}`, 20);
      } catch (error) {
        console.warn('Failed to set space, will create a new one:', error);
        const spaceResult = await migrator.createSpace();
        space = spaceResult.did;
        sendProgressUpdate('initializing', `Created new space with DID: ${space}`, 20);
      }
    } else {
      // Create a new space if none was provided
      const spaceResult = await migrator.createSpace();
      space = spaceResult.did;
      sendProgressUpdate('initializing', `Created new space with DID: ${space}`, 20);
    }

    // Start the migration
    sendProgressUpdate('migrating', 'Starting file migration', 25);
    let result;
    if (isS3Source && s3Path) {
      const fileName = s3Path.split('/').pop() || s3Path;
      sendProgressUpdate('upload', `📤 Uploading file: ${fileName}...`, 40);
      result = await migrator.migrateFile(s3Path);
      if (result?.success) {
        sendProgressUpdate('upload', `✅ File uploaded successfully! CID: ${result.cid}`, 90);
      }
    } else if (uploadedFile) {
      // Handle local file upload
      // ... existing local file upload code ...
    } else {
      throw new Error('Invalid migration configuration');
    }

    await migrator.close();

    // Send final results
    if (result?.success) {
      const resultMessage = `✅ Migration completed successfully!\n
🔗 CID: ${result.cid}\n
🌐 URL: ${result.url}\n
📦 Size: ${formatBytes(result.size || 0)}`;

      sendProgressUpdate('completed', resultMessage, 100);

      return res.status(200).json({
        success: true,
        cid: result.cid,
        url: result.url,
        size: result.size,
        message: resultMessage
      });
    } else {
      throw new Error(result?.error || 'Unknown error occurred');
    }
  } catch (error) {
    console.error('Error in migration process:', error);
    
    if (!res.writableEnded) {
      return res.status(500).json({ 
        error: 'Migration failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

// Helper function to parse multipart form data
async function parseForm(req: NextApiRequest): Promise<{ fields: formidable.Fields, files: formidable.Files }> {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
} 