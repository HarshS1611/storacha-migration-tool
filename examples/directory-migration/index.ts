import dotenv from 'dotenv';
import { StorachaMigrator, MigrationProgress } from 'storacha-migration-tool';

dotenv.config();

function createPhaseDisplay(phase: 'download' | 'upload' | 'preparing', progress: MigrationProgress): string {
  if (phase === 'preparing') return 'PREPARING: [----------------] 0%';
  
  const bar = phase === 'download' ? progress.downloadBar : progress.uploadBar;
  const percentage = phase === 'download' ? progress.downloadProgress : progress.uploadProgress;
  const speed = phase === 'download' ? progress.downloadSpeed : progress.uploadSpeed;
  const size = phase === 'download' 
    ? `${progress.downloadedBytes}/${progress.totalDownloadBytes} bytes`
    : `${progress.uploadedBytes}/${progress.totalUploadBytes} bytes`;
  
  return `${phase.toUpperCase()}: ${bar || ''} ${(percentage || 0).toFixed(1)}% | ${speed || '0 B/s'} | ${size}`;
}

async function main() {
  console.log('\n🚀 Starting Storacha Migration Tool\n');

  // Configuration
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
      console.log('📦 Directory Migration Progress\n');
      
      // Show current status based on phase
      switch (progress.phase) {
        case 'preparing':
          console.log('🔄 Preparing Migration');
          console.log('--------------------');
          console.log('- Scanning S3 directory');
          console.log('- Calculating total size');
          console.log('- Preparing file batches\n');
          break;
          
        case 'download':
        case 'upload':
          // Display current phase and file
          console.log(`Current Phase: ${progress.phase.toUpperCase()}`);
          console.log(`Current File: ${progress.currentFile || 'None'}\n`);
          
          // Show progress bars
          if (progress.totalDownloadBytes > 0) {
            console.log(createPhaseDisplay('download', progress));
          }
          if (progress.totalUploadBytes > 0) {
            console.log(createPhaseDisplay('upload', progress));
          }
          
          // Show overall stats
          console.log('\nOverall Progress');
          console.log('-----------------');
          console.log(`Files: ${progress.completedFiles || 0}/${progress.totalFiles || 0}`);
          console.log(`Total Size: ${progress.totalSize || '0 B'}`);
          console.log(`Processed: ${progress.uploadedSize || '0 B'}`);
          console.log(`Time Left: ${progress.estimatedTimeRemaining || 'Calculating...'}`);
          
          // Show sharding info if applicable
          if (progress.currentShardIndex !== undefined && progress.totalShards !== undefined) {
            console.log(`\nSharding Progress: ${progress.currentShardIndex + 1}/${progress.totalShards}`);
          }
          break;
      }
      
      // Show errors if any
      if (progress.failedFiles > 0) {
        console.log('\n⚠️ Errors');
        console.log('--------');
        progress.errors.forEach(({ file, error }) => {
          console.log(`- ${file}: ${error.message}`);
        });
      }
    });

    migrator.onError((error: Error, fileKey?: string) => {
      console.error(`\n❌ Error: ${error.message}`);
      if (fileKey) {
        console.error(`   File: ${fileKey}`);
      }
    });

    // Start migration
    const result = await migrator.migrateDirectory('images');
    
    // Show results
    console.log('\n✅ Migration Summary');
    console.log('-----------------');
    console.log(`Status: ${result.success ? 'Successful' : 'Failed'}`);
    if (result.success) {
      console.log(`CID: ${result.cid}`);
      console.log(`URL: ${result.url}`);
      console.log(`Size: ${result.size} bytes`);
    } else if (result.error) {
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);