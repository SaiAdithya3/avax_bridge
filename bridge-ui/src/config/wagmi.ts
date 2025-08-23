import { createConfig, http } from 'wagmi';
import { mainnet, polygon, avalanche, sepolia, baseSepolia, arbitrumSepolia } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';


export const config = createConfig({
  chains: [mainnet, polygon, avalanche, sepolia, baseSepolia, arbitrumSepolia],
  connectors: [
    metaMask(),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});
