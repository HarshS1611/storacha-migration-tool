# Storacha Migration Tool

A robust library for migrating files and directories from AWS S3 to Storacha (Web3.Storage).

This project is a TypeScript-based tool for transferring files and directories from an S3 bucket directly to Storacha using [w3up-client](https://docs.storacha.network/w3up-client/), without downloading them locally. You can achieve this using [AWS SDK](https://github.com/aws/aws-sdk-js-v3) for TypeScript to fetch the file as a stream and then pass it to Storacha's uploadFile.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Storacha account
- AWS Account

## Setup

1. Clone the repository:

   ```sh
   https://github.com/HarshS1611/storacha-migration-tool.git
   cd storacha-migration-tool
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file in the root directory and add your Storacha email:
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET_NAME=your-s3-bucket-name
   STORACHA_EMAIL=your-email@example.com
   ```

## Development

1. Build the TypeScript code:

   ```sh
   npm run build
   ```

2. Watch for changes during development:
   ```sh
   npm run dev
   ```

## Running the Project

The compiled JavaScript files will be in the `dist` directory. Run the script using Node.js:

```sh
npm start
```

Or run directly with node:

```sh
node dist/index.js
```

## Usage

```sh
node dist/index.js file <file-key>        # Upload a single file
node dist/index.js dir <directory-path>   # Upload all files from a directory
node dist/index.js create-space            # Create a new Storacha space
node dist/index.js set-space <DID>         # Set the current Storacha space
```

## TypeScript Types

The project includes TypeScript type definitions for all major components:

- `FileData`: Interface for file buffer and name
- `UploadResponse`: Interface for upload operation results
- `S3ServiceConfig`: Interface for AWS S3 configuration
- `StorachaServiceConfig`: Interface for Storacha configuration

These types ensure type safety throughout the application and provide better IDE support.

## License

This project is licensed under the Permissive License Stack, meaning you can choose either the [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) or [MIT](https://opensource.org/licenses/MIT) license - see the [LICENSE.md](LICENSE.md) file for details.

For more information about the Permissive License Stack, see Protocol Labs' [blog post](https://protocol.ai/blog/announcing-the-permissive-license-stack/).

Copyright (c) 2025 Protocol Labs Dev Guild and contributors
