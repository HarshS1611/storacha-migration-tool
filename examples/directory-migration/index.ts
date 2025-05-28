import dotenv from 'dotenv';
import { StorachaMigrator, MigrationProgress } from 'storacha-migration-tool';
import chalk from 'chalk'; // For better console formatting
import ora from 'ora'; // For better loading indicators
import MigrationUI from './utils/migrationUI.js'; // Custom UI for migration status

dotenv.config();

async function main() {
  const ui = new MigrationUI();
  const spinner = ora('Initializing migration...').start();

  const migrator = new StorachaMigrator({
    s3: {
      bucketName: process.env.S3_BUCKET_NAME!,
      region: process.env.AWS_REGION!,
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

    const result = await migrator.migrateDirectory('images')
    await ui.showMigrationSummary(result);

  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red('\n❌ Fatal error:'), error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);