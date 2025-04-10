import { StorachaMigrator } from '@/components/StorachaMigrator';

export default function Home() {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          S3 to Storacha Migration Demo
        </h1>
        <p className="mt-2 text-gray-600">
          Migrate files directly from S3 to Storacha with detailed progress tracking
        </p>
      </div>

      <StorachaMigrator />

      <div className="text-center p-6 bg-gray-50 rounded-xl">
        <h2 className="text-xl font-semibold mb-2">How It Works</h2>
        <p className="text-gray-600 mb-4">
          This demo showcases the capabilities of the storacha-migration-tool library,
          allowing you to migrate files from Amazon S3 to Storacha (Web3.Storage)
          with detailed progress tracking.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 1: Configure</h3>
            <p className="text-sm text-gray-600 mt-1">
              Enter your S3 credentials and Storacha email to set up the migration.
            </p>
          </div>
          
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 2: Migrate</h3>
            <p className="text-sm text-gray-600 mt-1">
              Start the migration and watch real-time progress as your file moves to Storacha.
            </p>
          </div>
          
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-medium text-storacha">Step 3: Access</h3>
            <p className="text-sm text-gray-600 mt-1">
              Once migrated, receive the IPFS CID and URL to access your file on the decentralized web.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 