
import { setupGlobalTrustedSetupFromKeyFiles } from "./trustedSetupService";

// Simple utility to set up global trusted setup from .key files
export async function initializeGlobalTrustedSetup(): Promise<boolean> {
  try {
    console.log("Initializing global trusted setup from .key files...");
    
    const success = await setupGlobalTrustedSetupFromKeyFiles(
      "Production Trusted Setup",
      "Global trusted setup for all elections using .key files from public/trusted-setups/",
      "public/trusted-setups/verification.key", // verification key path
      "public/trusted-setups/proving.key",      // proving key path
      "system"
    );
    
    if (success) {
      console.log("✅ Global trusted setup initialized successfully!");
    } else {
      console.error("❌ Failed to initialize global trusted setup");
    }
    
    return success;
    
  } catch (error) {
    console.error("Error initializing global trusted setup:", error);
    return false;
  }
}

// You can call this function from the browser console to set up your trusted setup:
// import { initializeGlobalTrustedSetup } from './src/services/setupTrustedSetup';
// await initializeGlobalTrustedSetup();
