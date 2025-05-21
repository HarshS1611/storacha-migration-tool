# S3 to Storacha Migration UI

A Next.js application that demonstrates downloading files from Amazon S3 and uploading them to Storacha (Web3.Storage) with detailed progress tracking.

## Features

- **S3 Integration**: Download files from Amazon S3 with detailed progress information.
- **Storacha Upload**: Upload files to Storacha (Web3.Storage) with detailed progress metrics.
- **Email Authentication**: Authenticate with Storacha using your email address.
- **Sharding Visualization**: View shard progress for large file uploads.
- **Space Management**: Select from available Storacha spaces for uploads.
- **Responsive UI**: Built with Tailwind CSS for a clean, modern interface.

## Screenshots

![S3 Download Progress](https://example.com/path/to/screenshot1.png)
![Storacha Upload Progress](https://example.com/path/to/screenshot2.png)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- An AWS account with S3 access
- A Storacha (Web3.Storage) account with a registered email

## Getting Started

1. **Clone the Repository**

   ```bash
   git clone https://github.com/HarshS1611/storacha-migration-tool.git
   cd storacha-migration-tool
   ```

2. **Install Dependencies and Link Library**

   ```bash
   # Install the main library dependencies
   npm install
   
   # Build the library
   npm run build
   
   # Create a global link for the library
   npm link
   
   # Install the Next.js UI example dependencies
   cd examples/nextjs-migration-ui
   npm install
   
   # Link to the local library
   npm link storacha-migration-tool
   ```

3. **Start the Development Server**

   ```bash
   npm run dev
   ```

4. **Open the Browser**

   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

## Development Workflow

When making changes to the main library:

1. **Rebuild the Library**

   ```bash
   # In the root directory
   npm run build
   ```

2. **Restart the Next.js Development Server**

   ```bash
   # In examples/nextjs-migration-ui directory
   # Stop the current server (Ctrl+C) and restart it
   npm run dev
   ```

This workflow ensures that your UI application always uses the latest version of the library.

## Usage

### Downloading from S3

1. Enter your AWS credentials (Region, Access Key ID, Secret Access Key).
2. Specify the S3 bucket name and object key (path to the file).
3. Click "Download from S3" to start the download process.
4. View real-time progress, including:
   - Download speed
   - Bytes downloaded
   - Percentage complete
   - Estimated time remaining

### Uploading to Storacha

1. Enter your Storacha email address.
2. Optionally select a space from the dropdown menu (uses default space if none is selected).
3. Click "Upload to Storacha" to start the upload process.
4. View real-time progress, including:
   - Upload speed
   - Bytes uploaded
   - Percentage complete
   - Estimated time remaining
   - Shard progress (for large files)

5. After successful upload, view the file's:
   - Content Identifier (CID)
   - IPFS URL for accessing the file

## Implementation Details

This example directly uses the `storacha-migration-tool` library to handle the S3 to Storacha migration process. The UI is built with:

- Next.js for the React framework
- Tailwind CSS for styling
- TypeScript for type safety

The key components include:

- `S3Downloader`: Manages the S3 download process and progress tracking using the library
- `StorachaUploader`: Handles the Storacha upload process with progress and shard tracking
- `ProgressBar`: A reusable component for visualizing progress

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Protocol Labs Dev Guild
- Web3.Storage Team 