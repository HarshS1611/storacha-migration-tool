import dotenv from "dotenv";
import { StorachaMigrator } from "storacha-migration-tool";
dotenv.config();

async function main() {
  const migrator = new StorachaMigrator({
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || "my-bucket",
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    },
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
    console.log("Initializing migrator...");
    await migrator.initialize();
    console.log("Migrator initialized");

    // await migrator.createSpace();

    // migrator.onProgress((progress) => {
    //   console.log(`Migration progress: ${progress.percentage}%`);
    // });

    // migrator.onError((error, fileKey) => {
    //   console.error(`Error migrating ${fileKey}: ${error.message}`);
    // });

    // await migrator.migrateFile('HarshSinghResume.pdf');

    // await migrator.migrateDirectory('images1');

    // Migrate all MongoDB collections
    // await migrator.migrateMongoDb();

    // Or migrate a specific collection
    // await migrator.migrateMongoDb('cohort1');

    // List all updloaded files
    const res = await migrator.listFilesInSpace("did:key:z6MknM…tKkG");
    console.log("Uploads:", res);

    const res2 = await migrator.retrieveFilesInSpace("did:key:z6MknM…tKkG");
    console.log("Files:", res2);

    /* const res = await migrator.listSpaces();
       console.log('Spaces:', res);
       const res2 = await migrator.listFilesInSpace();
       console.log('Files in space:', res2); */
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await migrator.close();
  }
}

main().catch(console.error);
