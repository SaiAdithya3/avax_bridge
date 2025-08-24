import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { Order } from '../types/api';
import { useAssetsStore } from '../store/assetsStore';
import type { OrderStatus } from '../services/orderService';

interface SwapProgressProps {
    order: Order & {status: OrderStatus};
    initiationHash?: string | null;
    qrCodeUrl?: string;
    onInitiate?: () => void;
    isInitiating?: boolean;
    error?: string | null;
    isLoading?: boolean;
}

const stepMeta: Record<OrderStatus, {
    title: string;
    description: string;
    icon: React.ElementType;
}> = {
    created: {
        title: 'Awaiting Deposit',
        description: 'Send funds to the deposit address',
        icon: Clock,
    },
    deposit_detected: {
        title: 'Deposit Detected',
        description: 'Deposit transaction detected, waiting for confirmation',
        icon: Clock,
    },
    deposit_confirmed: {
        title: 'Deposit Confirmed',
        description: 'Deposit confirmed, waiting for redemption',
        icon: Clock,
    },
    counterPartyInitiated: {
        title: 'Counter Party Initiated',
        description: 'Counter party has initiated the swap',
        icon: Clock,
    },
    redeeming: {
        title: 'Redeeming',
        description: 'Swap is being redeemed',
        icon: Clock,
    },  
   
    counterPartyRedeemed: {
        title: 'Counter Party Redeemed',
        description: 'Counter party has redeemed the swap',
        icon: CheckCircle,
    },
   
    completed: {
        title: 'Swap Completed',
        description: 'Your swap has been completed successfully',
        icon: CheckCircle,
    },
};

const SwapProgress: React.FC<SwapProgressProps> = ({
    order,
    initiationHash,
    qrCodeUrl,
    onInitiate,
    isInitiating,
    error,
    isLoading = false
}) => {
    const { assets } = useAssetsStore();
    // If you want to always get the latest order from a store, you could do:
    // const { getOrderById } = useOrdersStore();
    // const latestOrder = getOrderById(order.id) || order;

    // Use the status from the order to determine the current step
    const currentStep: OrderStatus = order.status;

    const getAssetSymbol = (assetString: string): string => {
        const parts = assetString.split(':');
        return parts[parts.length - 1]?.toUpperCase() || assetString.toUpperCase();
    };

    const getChainName = (assetString: string): string => {
        const parts = assetString.split(':');
        return parts[0]?.replace(/_/g, ' ') || assetString;
    };

    const formatAmount = (amount: string, decimals: number) => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) return '0';
        const formattedAmount = numAmount / Math.pow(10, decimals);
        let str = formattedAmount.toFixed(decimals);
        str = str.replace(/\.?0+$/, '');
        return str;
    };

    // Loading state
    if (isLoading || !order || !order.source_swap || !order.destination_swap) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[300px] py-12"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mb-4"
                />
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-blue-700 font-medium text-lg"
                >
                    Loading swap data...
                </motion.p>
            </motion.div>
        );
    }

    // Check if swap has been initiated
    const hasInitiated = order.source_swap.initiate_tx_hash || order.destination_swap.initiate_tx_hash;

    // If not initiated, show minimal setup steps
    if (!hasInitiated) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Order Summary */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200"
                >
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Order Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">From:</span>
                                <span className="font-semibold text-gray-900">
                                    {formatAmount(
                                        order.source_swap.amount,
                                        assets.find(
                                            a => a.asset.symbol === getAssetSymbol(order.source_swap.asset) &&
                                            getChainName(a.chainName).toLowerCase() === getChainName(order.source_swap.chain).toLowerCase()
                                        )?.asset.decimals ?? 18
                                    )} {getAssetSymbol(order.source_swap.asset)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Source Chain:</span>
                                <span className="font-medium text-gray-900">{getChainName(order.source_swap.chain)}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">To:</span>
                                <span className="font-semibold text-gray-900">
                                    {formatAmount(
                                        order.destination_swap.amount,
                                        assets.find(
                                            a => a.asset.symbol === getAssetSymbol(order.destination_swap.asset) &&
                                            getChainName(a.chainName).toLowerCase() === getChainName(order.destination_swap.chain).toLowerCase()
                                        )?.asset.decimals ?? 18
                                    )} {getAssetSymbol(order.destination_swap.asset)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Destination Chain:</span>
                                <span className="font-medium text-gray-900">{getChainName(order.destination_swap.chain)}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* QR Code and Deposit Info */}
                {qrCodeUrl && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200"
                    >
                        <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Send Funds
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                            <div className="text-center">
                                <div className="bg-white border-2 border-green-200 rounded-xl p-4 inline-block mb-4 shadow-lg">
                                    <img src={qrCodeUrl} alt="Deposit Address QR Code" className="w-40 h-40" />
                                </div>
                                <p className="text-sm text-green-700">Scan with your wallet</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-green-600 mb-2">Or copy the address:</p>
                                    <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                                        <code className="text-sm break-all flex-1 text-green-800 font-mono">
                                            {order.source_swap?.deposit_address || '--'}
                                        </code>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => navigator.clipboard.writeText(order.source_swap?.deposit_address || '')}
                                            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                            title="Copy address"
                                        >
                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </motion.button>
                                    </div>
                                </div>
                                {onInitiate && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={onInitiate}
                                        disabled={isInitiating}
                                        className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/70 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        {isInitiating ? (
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                                Initiating Transaction...
                                            </div>
                                        ) : (
                                            'Initiate Transaction'
                                        )}
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        );
    }

    // If initiated, show progress steps
    const steps = Object.keys(stepMeta).map((stepId) => {
        const idx = Object.keys(stepMeta).indexOf(stepId);
        const currentIdx = Object.keys(stepMeta).indexOf(currentStep);
        let status: 'pending' | 'current' | 'completed' =
            idx < currentIdx ? 'completed'
            : idx === currentIdx ? 'current'
            : 'pending';
        return {
            id: stepId,
            ...stepMeta[stepId as keyof typeof stepMeta],
            status,
        };
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Progress Header */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3"
            >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">Swap Progress</h3>
                    <p className="text-gray-500">Track your swap status</p>
                </div>
            </motion.div>

            {/* Progress Steps */}
            <div className="space-y-4">
                {steps.map((step, index) => (
                    <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.1 }}
                        className="relative"
                    >
                        <div className="flex items-start space-x-4">
                            {/* Step Icon */}
                            <motion.div
                                className="flex-shrink-0 mt-1"
                                whileHover={{ scale: 1.1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            >
                                {step.status === 'completed' ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                        className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"
                                    >
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    </motion.div>
                                ) : step.status === 'current' ? (
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"
                                    >
                                        <Clock className="w-5 h-5 text-blue-600" />
                                    </motion.div>
                                ) : (
                                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-gray-400" />
                                    </div>
                                )}
                            </motion.div>

                            {/* Step Content */}
                            <motion.div
                                className="flex-1 min-w-0"
                                whileHover={{ x: 5 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <div className={`p-4 rounded-xl border transition-all duration-300 ${
                                    step.status === 'completed' ? 'bg-green-50 border-green-200 text-green-800' :
                                    step.status === 'current' ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-lg' :
                                    'bg-gray-50 border-gray-200 text-gray-500'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold">{step.title}</h4>
                                            <p className="text-sm mt-1 opacity-90">{step.description}</p>
                                        </div>
                                        {step.status === 'completed' && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -180 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                            >
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Arrow */}
                            {index < steps.length - 1 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 + index * 0.1 }}
                                    className="flex-shrink-0 mt-4"
                                >
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                </motion.div>
                            )}
                        </div>

                        {/* Progress Line */}
                        {index < steps.length - 1 && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: step.status === 'completed' ? 20 : 0 }}
                                transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                                className="absolute left-4 top-8 w-0.5 bg-gradient-to-b from-green-400 to-blue-400"
                            />
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Current Step Actions */}
            <AnimatePresence mode="wait">
                {currentStep === 'deposit_detected' && (
                    <motion.div
                        key="deposit_detected"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-6"
                    >
                        <div className="flex flex-col items-center text-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <Clock className="w-12 h-12 text-yellow-500 mb-3" />
                            </motion.div>
                            <h4 className="text-lg font-semibold text-yellow-800 mb-2">Deposit Detected</h4>
                            <p className="text-yellow-700 mb-4">Your deposit transaction has been detected and is waiting for confirmation on the blockchain.</p>
                            {(initiationHash || order.source_swap.initiate_tx_hash) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="w-full p-4 bg-white rounded-xl border border-yellow-200"
                                >
                                    <p className="text-sm text-yellow-700 mb-2">Transaction Hash:</p>
                                    <div className="flex items-center gap-2">
                                        <code className="text-sm text-yellow-600 break-all flex-1 font-mono">
                                            {initiationHash || order.source_swap.initiate_tx_hash}
                                        </code>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => navigator.clipboard.writeText(initiationHash || order.source_swap.initiate_tx_hash || '')}
                                            className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                                            title="Copy hash"
                                        >
                                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}

                {currentStep === 'deposit_confirmed' && onInitiate && (
                    <motion.div
                        key="deposit_confirmed"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6"
                    >
                        <h4 className="text-lg font-semibold text-blue-900 mb-4">Initiate Destination Transaction</h4>
                        <p className="text-blue-700 mb-4">
                            Your deposit has been confirmed. Now click the button below to initiate the transaction on the destination chain.
                        </p>

                        {(initiationHash || order.source_swap.initiate_tx_hash) ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-green-50 border border-green-200 rounded-xl p-4"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="font-medium text-green-800">Transaction Initiated!</span>
                                </div>
                                <p className="text-sm text-green-700 mb-2">Transaction Hash:</p>
                                <code className="text-sm text-green-600 break-all font-mono">
                                    {initiationHash || order.source_swap.initiate_tx_hash}
                                </code>
                            </motion.div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onInitiate}
                                disabled={isInitiating}
                                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                {isInitiating ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                        Initiating Transaction...
                                    </div>
                                ) : (
                                    'Initiate Transaction'
                                )}
                            </motion.button>
                        )}
                    </motion.div>
                )}

                {currentStep === 'redeeming' && (
                    <motion.div
                        key="redeeming"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-6 text-center"
                    >
                        <div className="flex flex-col items-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <Clock className="w-12 h-12 text-yellow-500 mb-3" />
                            </motion.div>
                            <h4 className="text-lg font-semibold text-yellow-800 mb-2">Redeeming</h4>
                            <p className="text-yellow-700 mb-4">Your swap is being redeemed. This process may take a few minutes to complete.</p>
                            {(initiationHash || order.source_swap.initiate_tx_hash) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="w-full p-4 bg-white rounded-xl border border-yellow-200"
                                >
                                    <p className="text-sm text-yellow-700 mb-2">Transaction Hash:</p>
                                    <code className="text-sm text-yellow-600 break-all font-mono">
                                        {initiationHash || order.source_swap.initiate_tx_hash}
                                    </code>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}

                {currentStep === 'completed' && (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className="flex flex-col items-center"
                        >
                            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                            <h4 className="text-lg font-semibold text-green-800 mb-2">Swap Completed!</h4>
                            <p className="text-green-700">Your swap has been completed successfully. The funds have been transferred to your destination wallet.</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Display */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                            <p className="text-red-700">{error}</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default SwapProgress;
