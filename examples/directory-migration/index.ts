import dotenv from 'dotenv';
import { StorachaMigrator, MigrationProgress } from 'storacha-migration-tool';
import chalk from 'chalk'; // For better console formatting
import ora from 'ora'; // For better loading indicators
import cliProgress from 'cli-progress'; // For better progress bars

dotenv.config();

class MigrationUI {
  private multibar = new cliProgress.MultiBar({
    format: '{phase} |{bar}| {percentage}% | {value}/{total} | {speed}',
    barCompleteChar: '=',
    barIncompleteChar: '-',
    clearOnComplete: false,
    hideCursor: true
  }, cliProgress.Presets.shades_classic);

  private downloadBar: cliProgress.SingleBar | null = null;
  private uploadBar: cliProgress.SingleBar | null = null;
  private spinner = ora();

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  private createStatusHeader(progress: MigrationProgress): string {
    return `
${chalk.bold('📦 Migration Status')}
${chalk.gray('─'.repeat(50))}
${chalk.blue('Status')}: ${chalk.yellow(progress.status.toUpperCase())}
${chalk.blue('Phase')}: ${chalk.yellow(progress.phase.toUpperCase())}
${chalk.blue('Elapsed')}: ${chalk.yellow(progress.elapsedTime)}
    `;
  }

  private createShardInfo(progress: MigrationProgress): string {
    if (!progress.shardProgress) return '';

    const { shardIndex, totalShards, percentage } = progress.shardProgress;
    return `
${chalk.bold('🔄 Shard Progress')}
${chalk.gray('─'.repeat(50))}
Current Shard: ${shardIndex + 1}/${totalShards} (${percentage.toFixed(1)}%)
Size: ${this.formatBytes(progress.shardProgress.bytesUploaded)}/${this.formatBytes(progress.shardProgress.bytesTotal)}
    `;
  }

  private createTransferStats(progress: MigrationProgress): string {
    return `
${chalk.bold('📊 Transfer Statistics')}
${chalk.gray('─'.repeat(50))}
${chalk.blue('Download Speed')}: ${chalk.green(progress.downloadSpeed)}
${chalk.blue('Upload Speed')}: ${chalk.green(progress.uploadSpeed)}
${chalk.blue('Remaining Time')}: ${chalk.yellow(progress.estimatedTimeRemaining)}
    `;
  }

  private createOverallProgress(progress: MigrationProgress): string {
    return `
${chalk.bold('🎯 Overall Progress')}
${chalk.gray('─'.repeat(50))}
Files: ${progress.completedFiles}/${progress.totalFiles} (${progress.remainingFiles} remaining)
Total Size: ${this.formatBytes(progress.totalBytes)}
Progress: ${chalk.green(`${progress.percentage.toFixed(1)}%`)}
Batch: ${progress.currentBatch}/${progress.totalBatches}
    `;
  }

  private createRetryInfo(progress: MigrationProgress): string {
    if (progress.retryCount === 0) return '';

    return `
${chalk.bold('🔁 Retry Information')}
${chalk.gray('─'.repeat(50))}
Attempts: ${progress.retryCount}/${progress.maxRetries}
    `;
  }

  private createErrorSection(progress: MigrationProgress): string {
    if (progress.failedFiles === 0) return '';

    return `
${chalk.bold.red('⚠️ Errors')}
${chalk.gray('─'.repeat(50))}
${progress.errors.map(({ file, error }) =>
      `${chalk.red('✗')} ${file}: ${error.message}`
    ).join('\n')}
    `;
  }

  updateProgress(progress: MigrationProgress): void {
    console.clear();

    // Initialize progress bars if needed
    if (!this.downloadBar && progress.totalDownloadBytes > 0) {
      this.downloadBar = this.multibar.create(progress.totalDownloadBytes, 0, { phase: 'Download' });
    }
    if (!this.uploadBar && progress.totalUploadBytes > 0) {
      this.uploadBar = this.multibar.create(progress.totalUploadBytes, 0, { phase: 'Upload' });
    }

    // Update progress bars
    if (this.downloadBar) {
      this.downloadBar.update(progress.downloadedBytes, {
        speed: progress.downloadSpeed
      });
    }
    if (this.uploadBar) {
      this.uploadBar.update(progress.uploadedBytes, {
        speed: progress.uploadSpeed
      });
    }

    // Print status sections
    console.log([
      this.createStatusHeader(progress),
      progress.currentFile ? `Current File: ${chalk.cyan(progress.currentFile)}` : '',
      this.createShardInfo(progress),
      this.createTransferStats(progress),
      this.createOverallProgress(progress),
      this.createRetryInfo(progress),
      this.createErrorSection(progress)
    ].filter(Boolean).join('\n'));
  }

  async showMigrationSummary(result: any): Promise<void> {
    this.multibar.stop();
    console.log(`
${chalk.bold.green('✅ Migration Complete')}
${chalk.gray('─'.repeat(50))}
Status: ${result.success ? chalk.green('Successful') : chalk.red('Failed')}
${result.success ? `
CID: ${chalk.cyan(result.cid)}
URL: ${chalk.cyan(result.url)}
Size: ${chalk.yellow(this.formatBytes(result.size || 0))}
` : `Error: ${chalk.red(result.error)}`}
    `);
  }
}

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

    const result = await migrator.migrateFile('HarshSinghResume.pdf');
    await ui.showMigrationSummary(result);

  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red('\n❌ Fatal error:'), error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);