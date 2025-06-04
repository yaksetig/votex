
import { storeGlobalTrustedSetupWithFirebaseUrl } from "./trustedSetupService";

// Utility to set up global trusted setup with Firebase-hosted proving key
export async function setupGlobalTrustedSetupWithFirebase(
  name: string,
  description: string,
  verificationKey: any,
  firebaseProvingKeyUrl: string,
  createdBy: string = "admin"
): Promise<boolean> {
  try {
    console.log("Setting up global trusted setup with Firebase proving key...");
    
    const success = await storeGlobalTrustedSetupWithFirebaseUrl(
      name,
      description,
      verificationKey,
      firebaseProvingKeyUrl,
      createdBy
    );
    
    if (success) {
      console.log("✅ Global trusted setup with Firebase URL created successfully!");
    } else {
      console.error("❌ Failed to create global trusted setup with Firebase URL");
    }
    
    return success;
    
  } catch (error) {
    console.error("Error setting up Firebase trusted setup:", error);
    return false;
  }
}

// Example usage:
// await setupGlobalTrustedSetupWithFirebase(
//   "Production Setup (Firebase)",
//   "Global trusted setup using Firebase-hosted proving key",
//   verificationKeyJson,
//   "https://firebasestorage.googleapis.com/v0/b/your-project/o/proving-key.json?alt=media&token=your-token"
// );
