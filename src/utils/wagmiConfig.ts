
import { createConfig, http } from 'wagmi'
import { fallback, injected, unstable_connector } from '@wagmi/core'
import { getDefaultConfig } from 'connectkit'
import { mainnet, optimism, sepolia } from 'wagmi/chains'

// Define any custom chains if needed
const customChain = {
  id: 11155420,
  name: "Optimism Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Optimism Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://sepolia.optimism.io"] },
  },
  testnet: true,
}

// Create Wagmi config
export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [mainnet, optimism, sepolia, customChain],
    transports: {
      [mainnet.id]: http(),
      [optimism.id]: http(),
      [sepolia.id]: http(),
      [customChain.id]: http(customChain.rpcUrls.default.http[0]),
    },
    walletConnectProjectId: "218aeb7dfbffa618ed45df49cd77d8eb",
    appName: "Votex - Anonymous Voting Platform",
  })
)
