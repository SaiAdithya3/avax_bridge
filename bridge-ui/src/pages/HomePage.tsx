import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Swap from '../components/Swap';
import UserOrders from '../components/UserOrders';

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'swap' | 'orders'>('swap');

  const tabs = [
    { id: 'swap', label: 'Bridge Assets', icon: '🌉' },
    { id: 'orders', label: 'My Orders', icon: '📋' },
  ] as const;

  return (
    <div className="w-full mx-auto px-4 py-8">
      {/* Tab Navigation */}
      <div className="flex justify-center mb-8 w-full max-w-lg mx-auto">
        <div className="bg-white w-full rounded-2xl shadow-lg border border-gray-100 p-2">
          <div className="flex space-x-2 w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 w-full justify-center rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[#e84142] text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className=''
        >
          {activeTab === 'swap' ? (
            <div className="fle justify-center">
              <Swap />
            </div>
          ) : (
            <UserOrders />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default HomePage;