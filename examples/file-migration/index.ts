import dotenv from 'dotenv';
import { StorachaMigrator } from 'storacha-migration-tool';
import type { MigrationProgress } from 'storacha-migration-tool';

dotenv.config();

async function main() {
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
    await migrator.initialize();
    console.log('\n🚀 Starting migration...\n');

    let lastProgress = 0;
    migrator.onProgress((progress: any) => {
      console.clear();
      console.log(progress.formattedProgress, `${progress.percentage.toFixed(1)}%`);
      console.log(`Current file: ${progress.currentFile || 'Preparing...'}`);
      console.log(`Files: ${progress.completedFiles}/${progress.totalFiles}`);
      console.log(`Speed: ${progress.uploadSpeed}/s`);
      console.log(`Size: ${progress.uploadedSize} / ${progress.totalSize}`);
      console.log(`Time: ${progress.estimatedTimeRemaining}`);
      
      if (progress.failedFiles > 0) {
        console.log(`\n⚠️ Failed files: ${progress.failedFiles}`);
      }
    });

    migrator.onError((error: Error, fileKey?: string) => {
      console.error(`\n❌ Error migrating ${fileKey}: ${error.message}`);
    });

    await migrator.migrateFile('HarshSinghResume.pdf');
    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);
