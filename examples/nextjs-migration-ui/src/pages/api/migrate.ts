import { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';

// This handler runs on the server side, where Node.js modules are available
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, s3Config, fileKey } = req.body;

    if (action !== 'migrateFile') {
      return res.status(400).json({ error: 'This endpoint only supports migrateFile action' });
    }

    if (!fileKey) {
      return res.status(400).json({ error: 'File key is required for migrateFile action' });
    }

    if (!s3Config || !s3Config.region || !s3Config.bucketName) {
      return res.status(400).json({ error: 'S3 configuration is incomplete' });
    }

    // For S3 operations, we'll use AWS SDK directly rather than the full StorachaMigrator
    // This avoids requiring Storacha login for S3-only operations
    const s3Client = new AWS.S3({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.credentials.accessKeyId,
        secretAccessKey: s3Config.credentials.secretAccessKey
      }
    });

    console.log(`Attempting to download ${fileKey} from bucket ${s3Config.bucketName}`);

    try {
      // Get the object metadata first to know the content size
      const headResponse = await s3Client.headObject({
        Bucket: s3Config.bucketName,
        Key: fileKey
      }).promise();

      // Download the actual file
      const response = await s3Client.getObject({
        Bucket: s3Config.bucketName,
        Key: fileKey
      }).promise();

      // Generate a filename from the key
      const fileName = fileKey.split('/').pop() || 'downloaded-file';

      // Return success with metadata
      return res.status(200).json({
        success: true,
        size: headResponse.ContentLength || 0,
        fileName: fileName,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified
      });
    } catch (s3Error) {
      console.error('S3 Error:', s3Error);
      return res.status(500).json({
        error: 'S3 Error',
        message: s3Error.message || 'Failed to download file from S3'
      });
    }
  } catch (error) {
    console.error('Error in migration API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 