import { NextApiRequest, NextApiResponse } from 'next';
import { StorachaMigrator } from 'storacha-migration-tool';

// This handler runs on the server side, where Node.js modules are available
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, s3Config, pathKey, isDirectory, storachaConfig } = req.body;

    if (!s3Config || !pathKey || !storachaConfig) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

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
    });

    // Initialize the migrator
    await migrator.initialize();

    // Perform migration based on the action
    let result;
    if (action === 'migrateFileToStoracha') {
      result = await migrator.migrateFile(pathKey);
    } else if (action === 'migrateDirectoryToStoracha') {
      result = await migrator.migrateDirectory(pathKey);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Handle the migration result
    if (result.success) {
      return res.status(200).json({
        success: true,
        cid: result.cid,
        url: result.url,
        size: result.size
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.error || 'Migration failed'
      });
    }
  } catch (error) {
    console.error('Error in migrate API:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Clean up any resources if needed
  }
} 