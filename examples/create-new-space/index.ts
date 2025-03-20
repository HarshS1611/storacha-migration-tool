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
    console.log('\n🚀 Creating New space...\n');

    await migrator.createSpace();
    console.log('\n✅ New space created successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);