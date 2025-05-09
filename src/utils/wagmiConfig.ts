
import { createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { createConnector } from 'wagmi/connectors';

// Create a custom connector configuration that's compatible with the current version of Wagmi
export const wagmiConfig = createConfig({
  connectors: [
    createConnector(({ chains }) => ({
      id: 'injected',
      name: 'Injected',
      type: 'injected',
      chains,
      connect: async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('Ethereum provider not found');
        }
        
        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        return {
          accounts,
          chainId: Number(window.ethereum.chainId)
        };
      }
    })),
  ],
});
