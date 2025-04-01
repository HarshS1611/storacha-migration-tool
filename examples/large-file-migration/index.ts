import dotenv from 'dotenv';
import { StorachaMigrator } from 'storacha-migration-tool';
import type { MigrationProgress, UploadResponse } from 'storacha-migration-tool';

dotenv.config();

function createProgressBar(percentage: number, width: number = 30): string {
  const completed = Math.floor((width * percentage) / 100);
  const remaining = width - completed;
  return `[${'='.repeat(completed)}${'-'.repeat(remaining)}]`;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function main() {
  console.log('\n🚀 Starting Storacha Migration Tool\n');

  const migrator = new StorachaMigrator({
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'my-bucket',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    },
    storacha: {
      email: process.env.STORACHA_EMAIL!
    },
    retry: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000
    },
    batch: {
      concurrency: 5,
      size: 10
    }
  });

  try {
    // Step 1: Authentication Phase
    console.log('🔑 Authentication Phase');
    console.log('----------------------');
    console.log('1. Initializing Storacha client...');
    await migrator.initialize();
    console.log('2. Checking subscription status...');
    console.log('3. Verifying space access...\n');
    
    // Step 2: Migration Phase
    console.log('📦 Migration Phase');
    console.log('----------------');

    migrator.onProgress((progress: MigrationProgress) => {
      console.clear();
      

      // Download Progress Bar
      const downloadPercentage = progress.downloadedBytes && progress.totalDownloadBytes ? 
        (progress.downloadedBytes / progress.totalDownloadBytes) * 100 : 0;
      console.log('DOWNLOAD:', createProgressBar(downloadPercentage), 
        `${downloadPercentage.toFixed(1)}% | ${progress.downloadSpeed || '0 B/s'} | ` +
        `${formatBytes(progress.downloadedBytes)}/${formatBytes(progress.totalDownloadBytes)}`
      );

      // Upload Progress Bar
      const uploadPercentage = progress.uploadedBytes && progress.totalUploadBytes ? 
        (progress.uploadedBytes / progress.totalUploadBytes) * 100 : 0;
      console.log('UPLOAD:  ', createProgressBar(uploadPercentage), 
        `${uploadPercentage.toFixed(1)}% | ${progress.uploadSpeed || '0 B/s'} | ` +
        `${formatBytes(progress.uploadedBytes)}/${formatBytes(progress.totalUploadBytes)}`
      );

      // Overall Progress
      console.log('\nOverall Progress');
      console.log('-----------------');
      console.log(`Files: ${progress.completedFiles}/${progress.totalFiles}`);
      console.log(`Total Size: ${formatBytes(progress.totalBytes)}`);
      console.log(`Processed: ${formatBytes(progress.bytesUploaded)}`);
      console.log(`Time Left: ${progress.estimatedTimeRemaining || 'Calculating...'}`);

      // Display shard information if available
      if (progress.currentShardIndex !== undefined && progress.totalShards !== undefined) {
        console.log(`\nProcessing Shard: ${progress.currentShardIndex + 1}/${progress.totalShards}`);
      }
    });

    migrator.onError((error: Error, fileKey?: string) => {
      console.error(`\n❌ Error migrating ${fileKey}: ${error.message}`);
    });

    const result = await migrator.migrateDirectory('largeFile');
    
    // Step 3: Display Results
    console.log('\n📊 Migration Results');
    console.log('------------------');
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`\n🔗 CID: ${result.cid}`);
      console.log(`🌐 URL: ${result.url}`);
      console.log(`📦 Size: ${formatBytes(result.size)}`);
    } else {
      console.error('❌ Migration failed:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);