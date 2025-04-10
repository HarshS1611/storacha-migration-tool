import { useState } from 'react';
import { S3Downloader } from '@/components/s3/S3Downloader';
import { StorachaUploader } from '@/components/storacha/StorachaUploader';

export default function Home() {
  const [downloadedFile, setDownloadedFile] = useState<File | undefined>();

  const handleFileDownload = (file: File) => {
    setDownloadedFile(file);
  };

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          S3 to Storacha Migration Demo
        </h1>
        <p className="mt-2 text-gray-600">
          Download files from S3 and upload them to Storacha with detailed progress tracking
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <S3Downloader onFileDownload={handleFileDownload} />
        <StorachaUploader file={downloadedFile} />
      </div>

      <div className="text-center p-6 bg-gray-50 rounded-xl">
        <h2 className="text-xl font-semibold mb-2">How It Works</h2>
        <p className="text-gray-600 mb-4">
          This demo showcases the capabilities of the storacha-migration-tool library,
          allowing you to migrate files from Amazon S3 to Storacha (Web3.Storage)
          with detailed progress tracking.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 1: Download</h3>
            <p className="text-sm text-gray-600 mt-1">
              Enter your S3 credentials and file path to download a file with progress tracking.
            </p>
          </div>
          
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 2: Upload</h3>
            <p className="text-sm text-gray-600 mt-1">
              Enter your Storacha email and select a space to upload the downloaded file.
            </p>
          </div>
          
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 3: Access</h3>
            <p className="text-sm text-gray-600 mt-1">
              Once uploaded, receive the IPFS CID and URL to access your file on the decentralized web.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 