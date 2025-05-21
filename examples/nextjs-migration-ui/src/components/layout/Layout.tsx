import React, { ReactNode } from 'react';
import Head from 'next/head';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>S3 to Storacha Migration Tool</title>
        <meta name="description" content="A tool for migrating files from S3 to Storacha" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      
      <footer className="bg-storacha text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm">
                &copy; {new Date().getFullYear()} Protocol Labs Dev Guild
              </p>
            </div>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/HarshS1611/storacha-migration-tool" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-200 hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a 
                href="https://console.storacha.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-200 hover:text-white transition-colors"
              >
                Storacha Console
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}; 