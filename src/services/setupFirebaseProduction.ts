
import { setupGlobalTrustedSetupWithFirebase } from "./setupFirebaseTrustedSetup";

// Production Firebase trusted setup configuration
const FIREBASE_PROVING_KEY_URL = "https://firebasestorage.googleapis.com/v0/b/proving-key-storage.firebasestorage.app/o/pk.json?alt=media&token=be58815e-edc6-45be-ab95-fc43dc142174";

// Read verification key from local file
async function getVerificationKey(): Promise<any> {
  try {
    const response = await fetch('/trusted-setups/verification-key.key');
    if (!response.ok) {
      throw new Error(`Failed to fetch verification key: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error reading verification key:", error);
    throw error;
  }
}

// Set up production trusted setup with Firebase proving key
export async function setupProductionFirebaseTrustedSetup(): Promise<boolean> {
  try {
    console.log("Setting up production Firebase trusted setup...");
    
    // Get verification key from local file
    const verificationKey = await getVerificationKey();
    
    const success = await setupGlobalTrustedSetupWithFirebase(
      "Production Firebase Setup",
      "Global trusted setup using Firebase-hosted proving key for production",
      verificationKey,
      FIREBASE_PROVING_KEY_URL,
      "production-admin"
    );
    
    if (success) {
      console.log("✅ Production Firebase trusted setup created successfully!");
      console.log("🔥 Proving key URL:", FIREBASE_PROVING_KEY_URL);
    } else {
      console.error("❌ Failed to create production Firebase trusted setup");
    }
    
    return success;
    
  } catch (error) {
    console.error("Error setting up production Firebase trusted setup:", error);
    return false;
  }
}

// You can call this function from the browser console:
// import { setupProductionFirebaseTrustedSetup } from './src/services/setupFirebaseProduction';
// await setupProductionFirebaseTrustedSetup();
