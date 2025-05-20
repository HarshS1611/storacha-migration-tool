# MongoDB to Storacha Migration Example

This example demonstrates how to use the Storacha Migration Tool to migrate files from MongoDB to Storacha (Web3.Storage).

## Setup

1. Clone the repo

```bash
https://github.com/HarshS1611/storacha-migration-tool.git
cd storacha-migration-tool
```

2. First, build and link the main library:

```bash
# In the root directory (storacha-migration-tool)
npm install
npm run build
npm link
```

3. Set up the example project:

```bash
# In examples/directory-migration
npm install
npm link storacha-migration-tool
```

4. Create a `.env` file in this directory with your credentials:

```env
STORACHA_EMAIL=your_email@example.com
MONGODB_URI=your_mongo_uri
MONGODB_DB_NAME=your_collection_name
```

## Running the Example

```bash
npm run start
```

This will:

1. Initialize the migrator with your credentials
2. Connect to both MongoDB and Storacha services
3. Migrate files from the specified MongoDB collection
4. Show real-time progress including:
   - Visual progress bar
   - Upload speed
   - File counts
   - Estimated time remaining
   - Current file being processed

## Example Output

```
Migration Progress:
[==========----------] 33.5%
Current file: images/photo.jpg
Files: 10/30
Speed: 2.5 MB/s
Size: 25.5 MB / 76.2 MB
Time: 2m 15s remaining
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

# In examples/directory-migration
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
