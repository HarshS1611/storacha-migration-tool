# Storacha Migration Tool

This project is a tool for transfering files and directories from an S3 bucket directly to Storacha using [w3up-client](https://docs.storacha.network/w3up-client/), without downloading them locally. You can achieve this using [AWS SDK](https://github.com/aws/aws-sdk-js-v3) for JavaScript to fetch the file as a stream and then pass it to Storacha’s uploadFile.

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

## Running the Project

You can run the script file and use the functions as shown in the examples above. Run the script using Node.js:

```sh
node src/index.js
```

## Usage

```sh
node src/index.js file <file-key>        # Upload a single file
node src/index.js dir <directory-path>   # Upload all files from a directory
node src/index.js create-space  # Create a new Storacha space
node src/index.js set-space <DID>        # Set the current Storacha space
```

