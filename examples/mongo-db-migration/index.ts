import dotenv from "dotenv";
import { StorachaMigrator } from "storacha-migration-tool";
import chalk from "chalk"; // For better console formatting
import ora from "ora"; // For better loading indicators
import MigrationUI from "./migrationUI/index.js";

dotenv.config();

async function main() {
  const ui = new MigrationUI();
  const spinner = ora("Initializing migration...").start();

  const migrator = new StorachaMigrator({
    mongodb: {
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
      dbName: process.env.MONGODB_DB_NAME || "test",
    },
    storacha: {
      email: process.env.STORACHA_EMAIL || "",
    },
    retry: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000,
    },
    batch: {
      concurrency: 5,
      size: 10,
    },
  });

  try {
    spinner.text = "Initializing Storacha client...";
    await migrator.initialize();

    spinner.succeed("Initialization complete");

    migrator.onProgress(ui.updateProgress.bind(ui));
    migrator.onError((error: Error, fileKey?: string) => {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (fileKey) {
        console.error(chalk.red(`   File: ${fileKey}`));
      }
    });

    // create a new space or set the space to the one you want to use
    // await migrator.createSpace();
    // await migrator.setSpace("your-space-did");

    const result = await migrator.migrateMongoDb();
    await ui.showMigrationSummary(result);
  } catch (error) {
    spinner.fail("Migration failed");
    console.error(chalk.red("\n❌ Fatal error:"), error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);
