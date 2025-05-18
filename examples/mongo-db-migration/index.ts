import dotenv from 'dotenv';
import { StorachaMigrator } from 'storacha-migration-tool';
import chalk from 'chalk'; // For better console formatting
import ora from 'ora'; // For better loading indicators
import MigrationUI from './migrationUI/index.js';

dotenv.config();

async function main() {
  const ui = new MigrationUI();
  const spinner = ora('Initializing migration...').start();

  const migrator = new StorachaMigrator({
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'my-bucket',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DB_NAME || 'test'
    },
    storacha: {
      email: process.env.STORACHA_EMAIL || ''
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
    spinner.text = 'Initializing Storacha client...';
    await migrator.initialize();
    
    spinner.succeed('Initialization complete');

    migrator.onProgress(ui.updateProgress.bind(ui));
    migrator.onError((error: Error, fileKey?: string) => {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (fileKey) {
        console.error(chalk.red(`   File: ${fileKey}`));
      }
    });
    // await migrator.createSpace();

    const result = await migrator.migrateMongoDb()
    await ui.showMigrationSummary(result);

  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red('\n❌ Fatal error:'), error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);