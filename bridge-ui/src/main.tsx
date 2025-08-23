import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './config/wagmi.ts'
import { BTCWalletProvider } from "@gardenfi/wallet-connectors";
import { network } from "./constants/constants";
import type { Network } from '@gardenfi/utils'

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
    <QueryClientProvider client={queryClient}>
    <WagmiProvider config={config}>
    <BTCWalletProvider network={network as Network} store={localStorage}>
    <App />
    </BTCWalletProvider>
    </WagmiProvider>
    </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
