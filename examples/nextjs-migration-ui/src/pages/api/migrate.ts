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

    if (action !== 'downloadFromS3') {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!s3Config || !fileKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize S3 client
    const s3 = new AWS.S3({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.credentials.accessKeyId,
        secretAccessKey: s3Config.credentials.secretAccessKey
      }
    });

    // Get object metadata
    const headParams = {
      Bucket: s3Config.bucketName,
      Key: fileKey
    };

    try {
      const metadata = await s3.headObject(headParams).promise();
      
      return res.status(200).json({
        success: true,
        size: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified
      });
    } catch (error) {
      console.error('Error getting S3 object metadata:', error);
      return res.status(404).json({
        error: 'File not found in S3',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in migrate API:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 