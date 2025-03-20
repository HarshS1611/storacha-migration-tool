# Basic Migration Example

This example demonstrates how to use the Storacha Migration Tool to migrate lage files (above 1 GB) from AWS S3 to Storacha (Web3.Storage).

## Setup

1. First, build and link the main library:
```bash
# In the root directory (storacha-migration-tool)
npm install
npm run build
npm link
```

2. Set up the example project:
```bash
# In examples/large-file-migration
npm install
npm link storacha-migration-tool
```

3. Create a `.env` file in this directory with your credentials:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_REGION=your_region
STORACHA_EMAIL=your_email@example.com
```

## Running the Example

```bash
npm run start
```

This will:
1. Initialize the migrator with your credentials
2. Connect to both S3 and Storacha services
3. Migrate files from the specified S3 directory
4. Show real-time progress including:
   - Visual progress bar
   - Upload speed
   - File counts
   - Estimated time remaining
   - Current file being processed

## Example Output

```
Migration Progress:
[======-------------] 21.5%
Current file: largeFile/large
Files: 0/2
Speed: 1.91 MB/s
Size: 857.69 MB / 1.95 GB
Time: 28m 15s remaining
```

## Troubleshooting

If you encounter any issues:

1. Make sure you've built the main library:
```bash
cd ../..
npm run build
```

2. Try relinking:
```bash
# In the root directory
npm link

# In examples/large-file-migration
npm link storacha-migration-tool
```

3. Check your .env file has all required credentials

4. Verify your AWS credentials have proper permissions

## Modifying the Example

The example code in `index.ts` shows how to:
- Configure the migrator
- Track progress
- Handle errors
- Migrate individual files or entire directories

Feel free to modify the configuration or try different migration scenarios! 