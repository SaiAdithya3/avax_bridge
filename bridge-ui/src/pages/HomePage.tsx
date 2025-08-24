import React from 'react';
import { motion } from 'framer-motion';
import Swap from '../components/Swap';
import { PendingOrdersManager } from '../components/PendingOrdersManager';
import { useAssetsStore } from '../store/assetsStore';

interface HomePageProps {
  showHero: boolean;
  onOrderCreated: (orderId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ showHero, onOrderCreated }) => {
  return (
    <div className="w-full mx-auto px-4 py-8">
      {/* Header */}
      {showHero && (
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Cross-Chain Bridge</h1>
          <p className="text-2xl font-medium text-gray-700 mb-2">Where Bitcoin moves at Avalanche speed.</p>
          <p className="text-lg text-gray-600">Swap assets between Bitcoin and any EVM chain securely</p>
        </div>
      )}

      {/* Swap Component */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center mb-8"
      >
        <Swap onOrderCreated={onOrderCreated} />
      </motion.div>

      {/* Pending Orders Manager */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-2xl mx-auto"
      >
        <PendingOrdersManager />
      </motion.div>
    </div>
  );
};

export default HomePage;