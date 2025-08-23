import React from 'react';
import Swap from '../components/Swap';
import ConnectWallet from '../components/ConnectWallet';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cross-Chain Bridge</h1>
          <p className="text-gray-600">Bridge your assets between different blockchains seamlessly</p>
        </div>
        
        <div className="flex flex-col items-center space-y-6">
          <ConnectWallet />
          <Swap />
        </div>
      </div>
    </div>
  );
};

export default HomePage;