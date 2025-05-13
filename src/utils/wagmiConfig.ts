
import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { InjectedConnector } from '@wagmi/connectors';

// Create a config compatible with the current version of Wagmi
export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    new InjectedConnector({
      chains: [mainnet],
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
  },
});
