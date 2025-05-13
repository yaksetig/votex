
import { 
  BabyJubjubKeyPair, 
  initBabyJubjub, 
  generateKeypair, 
  storeKeypair, 
  retrieveKeypair,
  getPublicKeyString
} from '@/services/fixedBabyJubjubService';

// Then in the useEffect for initialization, ensure it waits properly:
useEffect(() => {
  const initialize = async () => {
    try {
      // Initialize BabyJubjub first and await it completely
      await initBabyJubjub();
      console.log("BabyJubjub initialized successfully");
      
      // Only after initialization, we can load identity
      await loadIdentity();
    } catch (error) {
      console.error("Error initializing BabyJubjub:", error);
      toast({
        title: "Initialization Error",
        description: "Could not initialize cryptographic libraries. Please try again.",
        variant: "destructive",
      });
      // Still mark as initialized to show the UI
      setIsInitialized(true);
    }
  };
  
  // Run the async function
  initialize();
}, []);
