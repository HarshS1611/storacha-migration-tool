import { NextApiRequest, NextApiResponse } from 'next';
import { StorachaMigrator } from 'storacha-migration-tool';

// This handler runs on the server side, where Node.js modules are available
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set up SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Helper function to send an update to the client
  const sendUpdate = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    // Next.js doesn't expose flush directly, but we can try to flush if available
    // This is safe for both Node.js environments and serverless
    (res as any).flush?.();
  };

  try {
    const { action, s3Config, pathKey, isDirectory, storachaConfig } = req.body;

    if (!s3Config || !pathKey || !storachaConfig) {
      sendUpdate('error', { message: 'Missing required parameters' });
      return res.end();
    }

    // Create a custom logger to capture logs
    const logs: Array<{ level: string; message: string; timestamp: number }> = [];
    const logger = {
      info: (message: string) => {
        const log = { level: 'info', message, timestamp: Date.now() };
        logs.push(log);
        sendUpdate('log', log);
      },
      warn: (message: string) => {
        const log = { level: 'warn', message, timestamp: Date.now() };
        logs.push(log);
        sendUpdate('log', log);
      },
      error: (message: string) => {
        const log = { level: 'error', message, timestamp: Date.now() };
        logs.push(log);
        sendUpdate('log', log);
      },
      debug: (message: string) => {
        const log = { level: 'debug', message, timestamp: Date.now() };
        logs.push(log);
        sendUpdate('log', log);
      }
    };

    // Create StorachaMigrator instance
    const migrator = new StorachaMigrator({
      s3: {
        region: s3Config.region,
        bucketName: s3Config.bucketName,
        credentials: {
          accessKeyId: s3Config.credentials.accessKeyId,
          secretAccessKey: s3Config.credentials.secretAccessKey
        }
      },
      storacha: {
        email: storachaConfig.email
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
    }, undefined, logger);

    // Add hooks for detailed progress events
    migrator.onProgress((progress) => {
      // Add explicit phase information to the progress object
      const enhancedProgress = {
        ...progress,
        phase: progress.downloadedBytes && progress.totalDownloadBytes && progress.downloadedBytes < progress.totalDownloadBytes 
          ? 'downloading' 
          : progress.uploadedBytes && progress.totalUploadBytes && progress.uploadedBytes < progress.totalUploadBytes
          ? 'uploading'
          : 'migrating'
      };
      
      // Send the enhanced progress
      sendUpdate('progress', enhancedProgress);
      
      // Log detailed progress information
      if (progress.downloadedBytes && progress.totalDownloadBytes) {
        const downloadPercentage = (progress.downloadedBytes / progress.totalDownloadBytes) * 100;
        logger.info(`⬇️ Downloading: ${downloadPercentage.toFixed(1)}% | ${formatBytes(progress.downloadedBytes)}/${formatBytes(progress.totalDownloadBytes)}`);
      }
      
      if (progress.uploadedBytes && progress.totalUploadBytes) {
        const uploadPercentage = (progress.uploadedBytes / progress.totalUploadBytes) * 100;
        logger.info(`⬆️ Uploading: ${uploadPercentage.toFixed(1)}% | ${formatBytes(progress.uploadedBytes)}/${formatBytes(progress.totalUploadBytes)}`);
      }
    });

    // Initialize the migrator
    logger.info("🛠 Initializing Storacha client...");
    await migrator.initialize();
    logger.info("✅ Initialization complete");

    // Perform migration based on the action
    let result;
    if (action === 'migrateFileToStoracha') {
      const fileName = pathKey.split('/').pop() || pathKey;
      logger.info(`📄 Migrating file: ${fileName}`);
      result = await migrator.migrateFile(pathKey);
    } else if (action === 'migrateDirectoryToStoracha') {
      const dirName = pathKey.split('/').filter(Boolean).pop() || pathKey;
      logger.info(`📁 Migrating directory: ${dirName}`);
      result = await migrator.migrateDirectory(pathKey);
    } else {
      logger.error('Invalid action');
      sendUpdate('error', { message: 'Invalid action' });
      return res.end();
    }

    // Handle the migration result
    if (result.success) {
      logger.info(`✅ Migration completed successfully!`);
      logger.info(`🔗 CID: ${result.cid}`);
      if (result.url) {
        logger.info(`🌐 URL: ${result.url}`);
      }
      if (result.size) {
        logger.info(`📦 Size: ${formatBytes(result.size)}`);
      }
      
      sendUpdate('complete', {
        success: true,
        cid: result.cid,
        url: result.url,
        size: result.size
      });
    } else {
      logger.error(result.error || 'Migration failed');
      sendUpdate('error', { message: result.error || 'Migration failed' });
    }

    // End the stream
    return res.end();
  } catch (error) {
    console.error('Error in migrate API:', error);
    sendUpdate('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return res.end();
  }
}

// Helper function to format bytes
function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
} 