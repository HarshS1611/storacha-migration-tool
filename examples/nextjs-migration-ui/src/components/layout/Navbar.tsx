import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const Navbar: React.FC = () => {
  return (
    <nav className="bg-storacha text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-xl font-bold text-white">
              S3 to Storacha Migration
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/HarshS1611/storacha-migration-tool"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://console.storacha.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition-colors"
            >
              Storacha Console
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}; 