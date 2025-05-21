# Implementation Notes for NextJS Migration UI

## Overview
This example demonstrates a Next.js user interface for the `storacha-migration-tool` library, providing a complete UI for migrating files from S3 to Storacha (Web3.Storage) with real-time progress tracking.

## Architecture
The application follows a hybrid client-server architecture:

1. **Client-Side Components**
   - React components for UI rendering
   - Form handling for user input
   - Progress visualization
   - Mock implementations for browser environment

2. **Server-Side Processing**
   - API routes to handle actual migration tasks
   - Direct usage of Node.js modules (fs, path)
   - Integration with S3 and Storacha services

3. **Key Components**
   - `S3Downloader`: Manages S3 authentication and file downloading
   - `StorachaUploader`: Handles Storacha authentication and file uploads
   - `BrowserMigrator`: Client-side wrapper for StorachaMigrator with Node.js compatibility
   - `api/migrate.ts`: Server-side API endpoint for migration operations

## Key Implementation Details

### Browser Compatibility
This implementation addresses the challenges of using a Node.js library in a browser environment:

1. **Server-Side API**
   - Migration operations run on the server where Node.js modules are available
   - API endpoints provide a clean interface for client components

2. **Client-Side Mocks**
   - `BrowserMigrator.ts`: Provides browser-compatible wrapper for StorachaMigrator
   - `BrowserEventManager.ts`: Event management without filesystem dependencies

3. **Webpack Configuration**
   - Fallbacks for Node.js built-ins
   - Module aliases to substitute browser-compatible versions

### Resolving Module Import Errors

If you encounter the error:
```
Attempted import error: 'EventManager' is not exported from './managers/EventManager.js'
```

This can be resolved by:

1. **Creating a Mock EventManager Module**
   - Create a file at `src/managers/EventManager.js` that exports your browser-compatible EventManager
   - This intercepts imports in the `storacha-migration-tool` library

2. **Update Webpack Configuration**
   - Add proper aliases in `next.config.js` for various import paths
   - Provide browser-compatible implementations for Node.js modules

3. **Use Module Simulation**
   - Implement a simulated version of the library functionality
   - Gracefully handle both real and simulated modes

Example fix for the EventManager export issue:
```js
// src/managers/EventManager.js
import { BrowserEventManager } from '../utils/BrowserEventManager';
export const EventManager = BrowserEventManager;
export default BrowserEventManager;
```

### Authentication
- Uses email-based authentication for Storacha
- Stores AWS credentials securely within the component state
- Credentials are sent to server only when needed for operations

### Progress Tracking
- Client-side progress simulation for better UX
- Real progress tracking happens on the server
- Comprehensive metrics for both download and upload phases

## Development Notes
- Always rebuild the main library after making changes to it
- Restart the Next.js dev server to pick up library changes
- Use TypeScript to ensure type safety between the UI and library

## Known Limitations
- The UI does not currently support directory uploads
- Progress visualization is limited to one file at a time
- No persistent storage of credentials between sessions
- File data transfer between client and server is simulated

## Troubleshooting

### Webpack Import Errors
If you encounter build errors related to Node.js modules:

1. Check that all Node.js-specific imports are properly mocked
2. Review webpack configuration to ensure proper aliases and fallbacks
3. Consider adding simulation mode fallbacks for critical components

### Library Version Incompatibility
If the library interface changes:

1. Update the local type definitions to match the library
2. Adjust the mock implementations to conform to the new interface
3. Test both client and server implementations separately

## Server-Side Processing

For security and compatibility reasons, this implementation moves the core migration functionality to the server-side:

```typescript
// Server-side API route (pages/api/migrate.ts)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Create server-side migrator
  const migrator = new StorachaMigrator({
    s3: req.body.s3Config,
    storacha: req.body.storachaConfig,
    // ...other config
  });

  // Initialize the migrator
  await migrator.initialize();

  // Perform the requested action
  let result;
  switch (req.body.action) {
    case 'migrateFile':
      result = await migrator.migrateFile(req.body.fileKey);
      break;
    // ...other actions
  }

  // Return the result
  return res.status(200).json(result);
}
```

## Client-Side Implementation

The client components focus on user experience and interface, delegating heavy processing to the server:

```typescript
// Example of client-server interaction
const handleDownload = async () => {
  // Call server API
  const response = await fetch('/api/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'migrateFile',
      s3Config: { /* config */ },
      fileKey: objectKey
    }),
  });

  const result = await response.json();
  
  // Handle the result in UI
}
```

## Code Examples

### Initializing the StorachaMigrator

```typescript
const migrator = new StorachaMigrator({
  s3: {
    region: config.region,
    bucketName: config.bucketName,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  },
  storacha: {
    email: config.email
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
```

### Setting Up Progress Tracking

```typescript
migrator.onProgress((migrationProgress: MigrationProgress) => {
  // Update UI with progress information
  const uploadPercentage = migrationProgress.uploadedBytes && migrationProgress.totalUploadBytes
    ? (migrationProgress.uploadedBytes / migrationProgress.totalUploadBytes) * 100
    : 0;
    
  setProgress({
    loaded: migrationProgress.uploadedBytes || 0,
    total: migrationProgress.totalUploadBytes || 0,
    percentage: uploadPercentage,
    speed: migrationProgress.uploadSpeed ? parseFloat(migrationProgress.uploadSpeed) : 0,
    timeRemaining: migrationProgress.estimatedTimeRemaining 
      ? parseTimeRemaining(migrationProgress.estimatedTimeRemaining) 
      : 0,
    status: 'uploading',
    startTime: progress.startTime,
    fileName: migrationProgress.currentFile,
    shardProgress: // ... shard progress calculation
  });
});
```

### Handling File Upload

```typescript
// Initialize if needed
await migrator.initialize();

// Set space if specified
if (config.space) {
  await migrator.setSpace(config.space);
}

// Upload the file
const result = await migrator.uploadFile(file);

// Handle result
if (result.success) {
  // Show success UI with CID and URL
} else {
  // Show error UI
}
``` 