import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import AWS from 'aws-sdk';

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
}

interface UploadResult {
  success: boolean;
  cid?: string;
  url?: string;
  error?: string;
}

// This handler runs on the server side, where Node.js modules are available
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      percentage
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

  // For file upload actions
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    let tempDir = '';
    try {
      // Parse the form and extract the file and config
      sendProgressUpdate('initializing', 'Parsing uploaded file', 5);
      const { fields, files } = await parseForm(req);
      const uploadedFile = files.file?.[0];
      
      if (!uploadedFile) {
        throw new Error('No file found in upload');
      }

      const email = fields.email?.[0];
      const space = fields.space?.[0];
      const isS3Source = fields.isS3Source?.[0] === 'true';
      const s3Path = fields.s3Path?.[0];

      if (!email) {
        throw new Error('Storacha email is required');
      }

      // Set up the environment
      process.env.STORACHA_EMAIL = email;
      sendProgressUpdate('initializing', `Setting up with email: ${email}`, 10);

      // Create the migrator instance
      sendProgressUpdate('initializing', 'Creating StorachaMigrator instance', 15);
      const migrator = new StorachaMigrator({
        s3: {
          region: process.env.S3_REGION || 'us-east-1',
          bucketName: process.env.S3_BUCKET_NAME || '',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
          }
        },
        storacha: {
          email
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
      sendProgressUpdate('initializing', '🔑 Initializing Storacha client...', 10);
      await migrator.initialize();
      sendProgressUpdate('initializing', '✓ Client initialized\n📦 Checking subscription status...', 15);

      // Set space if provided
      if (space) {
        sendProgressUpdate('initializing', `Setting space: ${space}`, 20);
        await migrator.setSpace(space);
      }

      // Create a temporary working directory
      const tempDir = path.join(os.tmpdir(), 'storacha-upload-' + uuidv4());
      await fs.promises.mkdir(tempDir, { recursive: true });

      try {
        let result;
        
        if (isS3Source && s3Path) {
          // Handle S3 to Storacha migration
          sendProgressUpdate('downloading', `📥 Starting S3 migration from: ${s3Path}`, 25);
          
          // First verify S3 credentials and access
          try {
            await migrator.verifyS3Access();
            sendProgressUpdate('downloading', '✓ S3 access verified', 30);
          } catch (s3Error) {
            throw new Error(`S3 access verification failed: ${s3Error.message}`);
          }
          
          // Check if path ends with a slash or is a known directory path
          const isDirectory = s3Path.endsWith('/') || s3Path.includes('*');
          
          if (isDirectory) {
            // Use migrateDirectory for directory paths
            sendProgressUpdate('analyzing', `📂 Analyzing directory: ${s3Path}`, 35);
            result = await migrator.migrateDirectory(s3Path);
          } else {
            // Use migrateFile for single files from S3
            sendProgressUpdate('downloading', `📄 Downloading file: ${s3Path}`, 35);
            
            // Get the file name from the S3 path
            const fileName = s3Path.split('/').pop() || s3Path;
            
            // Create a temporary directory for the file
            const tempDir = path.join(os.tmpdir(), 'storacha-upload-' + uuidv4());
            await fs.promises.mkdir(tempDir, { recursive: true });
            
            try {
              // Download the file from S3
              const s3 = new AWS.S3({
                region: process.env.S3_REGION || 'us-east-1',
                credentials: {
                  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
                }
              });

              const s3Object = await s3.getObject({
                Bucket: process.env.S3_BUCKET_NAME || '',
                Key: s3Path
              }).promise();

              if (!s3Object.Body) {
                throw new Error('No file content received from S3');
              }

              // Write the file to temp directory
              const tempFilePath = path.join(tempDir, fileName);
              const body = s3Object.Body;
              
              if (Buffer.isBuffer(body)) {
                await fs.promises.writeFile(tempFilePath, new Uint8Array(body));
              } else if (body instanceof Readable) {
                await new Promise<void>((resolve, reject) => {
                  const writeStream = fs.createWriteStream(tempFilePath);
                  (body as Readable).pipe(writeStream)
                    .on('finish', () => resolve())
                    .on('error', reject);
                });
              } else if (typeof body === 'string') {
                await fs.promises.writeFile(tempFilePath, body, 'utf8');
              } else {
                throw new Error('Unexpected S3 response body type');
              }

              // Use migrateFile with the file path
              sendProgressUpdate('uploading', `📤 Uploading ${fileName}`, 40);
              result = await migrator.migrateFile(tempFilePath);

            } finally {
              // Clean up temp directory
              await fs.promises.rm(tempDir, { recursive: true, force: true });
            }
          }
        } else {
          // Handle local file to Storacha migration
          sendProgressUpdate('preparing', `📄 Processing file: ${uploadedFile.originalFilename}`, 30);
          
          // Ensure the file exists
          if (!fs.existsSync(uploadedFile.filepath)) {
            throw new Error('Source file does not exist');
          }

          const originalName = uploadedFile.originalFilename || 'file';
          
          // Create a read stream from the file
          const fileStream = fs.createReadStream(uploadedFile.filepath);
          
          // Set up the S3 client for local file upload
          const s3 = new AWS.S3({
            region: process.env.S3_REGION || 'us-east-1',
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
            }
          });

          // Upload to S3 first
          sendProgressUpdate('uploading', `📤 Uploading to S3: ${originalName}`, 35);
          await s3.upload({
            Bucket: process.env.S3_BUCKET_NAME || '',
            Key: originalName,
            Body: fileStream
          }).promise();

          // Now migrate directly using the S3 key
          sendProgressUpdate('migrating', `📤 Migrating to Storacha: ${originalName}`, 40);
          result = await migrator.migrateFile(originalName);

          // Clean up the temporary file
          await fs.promises.unlink(uploadedFile.filepath);
        }

        await migrator.close();

        // Send final results with CID and URL
        if (result.success) {
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
          throw new Error(result.error || 'Unknown error occurred');
        }

      } catch (error) {
        // Clean up on error
        try {
          if (tempDir) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
          }
          if (uploadedFile?.filepath) {
            await fs.promises.unlink(uploadedFile.filepath);
          }
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        console.error('Migration error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendProgressUpdate('error', `❌ Migration failed: ${errorMessage}`, 0);
        
        if (!res.writableEnded) {
          return res.status(500).json({ 
            error: 'Migration failed',
            message: errorMessage
          });
        }
      }
    } catch (error) {
      console.error('Error in migration process:', error);
      
      // Clean up on error
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Error cleaning up temp directory:', cleanupError);
        }
      }

      // Send error response if we haven't started streaming
      if (!res.writableEnded) {
        return res.status(500).json({ 
          error: 'Migration failed', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    return;
  }

  // If we get here, the content type is not supported
  return res.status(415).json({ error: 'Unsupported Media Type' });
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