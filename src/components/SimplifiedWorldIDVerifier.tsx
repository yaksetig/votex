// In src/components/SimplifiedWorldIDVerifier.tsx
import { 
  generateKeypair, 
  storeKeypair, 
  createKeypairFromSeed,
  getPublicKeyString,
  initBabyJubjub
} from '@/services/babyJubjubService';

// In the handleVerificationSuccess function:
const handleVerificationSuccess = async (result: ISuccessResult) => {
  try {
    setIsVerifying(true);
    setErrorMessage(null);
    console.log('Starting verification success handler');
    
    // Make sure World ID verification was successful
    if (!result || !result.merkle_root || !result.nullifier_hash) {
      throw new Error("Invalid World ID verification result");
    }
    
    console.log('World ID verification successful, generating keypair...');
    
    // Store user ID
    const userId = result.nullifier_hash;
    localStorage.setItem('worldid-user', userId);
    setUserId(userId);
    
    // Generate a keypair deterministically from the World ID proof
    const seed = `worldid-${userId}-${result.merkle_root}`;
    console.log('Creating keypair from seed:', seed.substring(0, 20) + '...');
    
    // First ensure BabyJubjub is initialized
    await initBabyJubjub();
    
    const keypair = await createKeypairFromSeed(seed);
    
    // Store the keypair securely
    console.log('Storing keypair...');
    storeKeypair(keypair);
    
    // Update the wallet context with the keypair
    console.log('Updating context...');
    setAnonymousKeypair(keypair);
    setIsWorldIDVerified(true);
    
    // Show success toast
    toast({
      title: "Verification successful",
      description: "Your anonymous identity has been created.",
    });
    
    // Call the success callback
    console.log('Calling success callback...');
    onVerificationSuccess();
    
    console.log('Verification success handler completed');
  } catch (err) {
    // Error handling remains the same...
  }
};
