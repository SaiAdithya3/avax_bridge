import { createConfig, http } from 'wagmi';
import { mainnet, polygon, avalanche } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

const projectId = 'YOUR_WALLET_CONNECT_PROJECT_ID'; // Replace with your project ID

export const config = createConfig({
  chains: [mainnet, polygon, avalanche],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
  },
});
