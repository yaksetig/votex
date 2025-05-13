
import { createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { InjectedConnector } from 'wagmi/connectors/injected';

// Create a config compatible with the current version of Wagmi
export const wagmiConfig = createConfig({
  connectors: [
    new InjectedConnector({
      chains: [mainnet],
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
  publicClient: ({ chainId }) => {
    const chain = chainId === mainnet.id ? mainnet : mainnet;
    return {
      chain,
      transport: {
        type: 'http',
        url: chain.rpcUrls.default.http[0],
      },
    };
  },
});
