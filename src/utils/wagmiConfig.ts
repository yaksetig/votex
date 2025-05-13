
import { createConfig } from 'wagmi';
import { getDefaultConfig } from 'connectkit';

export const wagmiConfig = createConfig(
  getDefaultConfig({
    // Required for WalletConnect
    walletConnectProjectId: 'placeholder',
    
    // App Info
    appName: 'Votex Platform',
    
    // Optional configuration
    appDescription: 'A secure voting platform with anonymous identity',
    appIcon: 'https://app.votex.io/logo.png',
    
    // For debugging
    debug: true,
  })
);
