/**
 * Passkey Service - WebAuthn PRF-based secret derivation
 * 
 * This service handles WebAuthn credential creation and PRF (Pseudo-Random Function)
 * extension for deterministic secret derivation across devices.
 * 
 * Security properties:
 * - Same passkey → same PRF output → same derived keys on any device
 * - PRF secret never leaves the authenticator
 * - Only credential ID stored locally (not secret material)
 */

// Domain salt for PRF - versioned for future migration capability
const PRF_DOMAIN_SALT = new TextEncoder().encode("votex:bjj:v1");

// Storage key for credential ID
const CREDENTIAL_STORAGE_KEY = "votex:passkey:credentialId";

export interface PasskeyCredential {
  credentialId: string;  // Base64 encoded credential ID
  createdAt: number;
}

export interface PasskeySupport {
  webauthnSupported: boolean;
  prfSupported: boolean;
}

export interface PRFResult {
  secret: ArrayBuffer;  // 32-byte PRF output
  credentialId: string;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random challenge for WebAuthn operations
 */
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Check if the browser supports WebAuthn and PRF extension
 * PRF extension is required for deterministic key derivation
 */
export async function checkPasskeySupport(): Promise<PasskeySupport> {
  // Check basic WebAuthn support
  if (!window.PublicKeyCredential) {
    return { webauthnSupported: false, prfSupported: false };
  }

  // Check if platform authenticator is available
  const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!platformAvailable) {
    return { webauthnSupported: false, prfSupported: false };
  }

  // PRF support detection is tricky - we'll verify during credential creation
  // For now, assume supported if WebAuthn is available on modern browsers
  return { webauthnSupported: true, prfSupported: true };
}

/**
 * Check if a passkey credential already exists for this app
 */
export function hasExistingPasskey(): boolean {
  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  return stored !== null;
}

/**
 * Get the stored credential ID if it exists
 */
export function getStoredCredentialId(): string | null {
  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const credential: PasskeyCredential = JSON.parse(stored);
    return credential.credentialId;
  } catch {
    return null;
  }
}

/**
 * Store credential ID after successful creation
 */
function storeCredentialId(credentialId: string): void {
  const credential: PasskeyCredential = {
    credentialId,
    createdAt: Date.now()
  };
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
}

/**
 * Clear stored credential ID (for logout/reset)
 */
export function clearStoredCredential(): void {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
}

/**
 * Create a new WebAuthn passkey credential with PRF extension
 * 
 * This creates a new passkey on the user's authenticator (platform or roaming)
 * and checks if PRF extension is supported.
 * 
 * @param userId - A unique identifier for the user (can be random for privacy)
 * @returns The credential ID if successful
 * @throws Error if creation fails or PRF is not supported
 */
export async function createPasskeyCredential(userId: Uint8Array): Promise<string> {
  const support = await checkPasskeySupport();
  if (!support.webauthnSupported) {
    throw new Error("WebAuthn is not supported on this device");
  }

  const challenge = generateChallenge();
  
  // Create credential with PRF extension request
  // Create challenge buffer to avoid SharedArrayBuffer issues
  const challengeBuffer = new ArrayBuffer(challenge.length);
  new Uint8Array(challengeBuffer).set(challenge);
  
  // Create user ID buffer
  const userIdBuffer = new ArrayBuffer(userId.length);
  new Uint8Array(userIdBuffer).set(userId);

  const createOptions: PublicKeyCredentialCreationOptions = {
    rp: {
      name: "Votex",
      id: window.location.hostname
    },
    user: {
      id: userIdBuffer,
      name: "votex-voter",
      displayName: "Votex Voter"
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }  // RS256 fallback
    ],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required"
    },
    timeout: 60000,
    challenge: challengeBuffer,
    extensions: {
      // Request PRF capability during credential creation
      // This tells us if the authenticator supports PRF
      prf: {}
    } as AuthenticationExtensionsClientInputs
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: createOptions
    }) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error("Credential creation returned null");
    }

    // Check if PRF extension is supported
    const extensionResults = credential.getClientExtensionResults() as {
      prf?: { enabled?: boolean };
    };

    if (!extensionResults.prf?.enabled) {
      throw new Error(
        "PRF extension is not supported by your authenticator. " +
        "Please use a passkey that supports the PRF/hmac-secret extension " +
        "(Chrome 116+, Safari 17.4+, or a compatible security key)."
      );
    }

    const credentialId = bufferToBase64(credential.rawId);
    storeCredentialId(credentialId);

    console.log("Passkey created successfully with PRF support");
    return credentialId;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey creation was cancelled or timed out");
      }
      if (error.name === "InvalidStateError") {
        throw new Error("A passkey already exists for this account");
      }
    }
    throw error;
  }
}

/**
 * Derive a deterministic secret from an existing passkey using PRF extension
 * 
 * This uses the WebAuthn PRF extension (hmac-secret) to derive a 32-byte
 * secret that is:
 * - Deterministic: Same passkey + same salt = same output
 * - Cross-device: Works on any device where the passkey is synced
 * - Hardware-backed: Secret derivation happens inside the authenticator
 * 
 * @param credentialId - The credential ID to use (from createPasskeyCredential)
 * @returns The PRF-derived secret (32 bytes)
 * @throws Error if authentication fails or PRF is not supported
 */
export async function deriveSecretFromPasskey(credentialId: string): Promise<PRFResult> {
  const challenge = generateChallenge();
  const credentialIdBuffer = base64ToBuffer(credentialId);

  // Create proper ArrayBuffer for challenge to avoid SharedArrayBuffer issues
  const challengeBuffer = new ArrayBuffer(challenge.length);
  new Uint8Array(challengeBuffer).set(challenge);

  // Create proper ArrayBuffer for PRF salt
  const prfSaltBuffer = new ArrayBuffer(PRF_DOMAIN_SALT.length);
  new Uint8Array(prfSaltBuffer).set(PRF_DOMAIN_SALT);

  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: challengeBuffer,
    allowCredentials: [{
      type: "public-key",
      id: credentialIdBuffer
    }],
    userVerification: "required",
    timeout: 60000,
    extensions: {
      // Request PRF evaluation with our domain salt
      // The authenticator will compute HMAC-SHA256(salt, hmac-secret)
      prf: {
        eval: {
          first: prfSaltBuffer
        }
      }
    } as AuthenticationExtensionsClientInputs
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: getOptions
    }) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error("Authentication returned null");
    }

    // Extract PRF result
    const extensionResults = assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    };

    if (!extensionResults.prf?.results?.first) {
      throw new Error(
        "PRF extension did not return a result. " +
        "Your authenticator may not support the PRF extension."
      );
    }

    const secret = extensionResults.prf.results.first;

    // Validate secret length (should be 32 bytes)
    if (secret.byteLength !== 32) {
      throw new Error(`Unexpected PRF output length: ${secret.byteLength} (expected 32)`);
    }

    console.log("PRF secret derived successfully");
    return {
      secret,
      credentialId
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey authentication was cancelled or timed out");
      }
      if (error.name === "SecurityError") {
        throw new Error("Security error during passkey authentication");
      }
    }
    throw error;
  }
}

/**
 * Authenticate with ANY available passkey using discoverable credentials
 * 
 * This uses an empty allowCredentials array which enables:
 * 1. Browser/OS to show all passkeys for this domain (from Keychain, Google PM, etc.)
 * 2. QR code scanning to use a passkey from another device (hybrid transport)
 * 
 * This is the key to cross-device and cross-session determinism:
 * - Works in private browsing (passkeys are in OS Keychain, not localStorage)
 * - Works across devices via synced passkeys or hybrid transport
 * 
 * @returns The PRF-derived secret from the selected passkey
 * @throws Error if authentication fails or is cancelled
 */
export async function authenticateWithAnyPasskey(): Promise<PRFResult> {
  const challenge = generateChallenge();

  // Create proper ArrayBuffer for challenge
  const challengeBuffer = new ArrayBuffer(challenge.length);
  new Uint8Array(challengeBuffer).set(challenge);

  // Create proper ArrayBuffer for PRF salt
  const prfSaltBuffer = new ArrayBuffer(PRF_DOMAIN_SALT.length);
  new Uint8Array(prfSaltBuffer).set(PRF_DOMAIN_SALT);

  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: challengeBuffer,
    rpId: window.location.hostname,
    // EMPTY allowCredentials enables discoverable credential flow
    // This shows the passkey picker with all available passkeys for this domain
    allowCredentials: [],
    userVerification: "required",
    timeout: 60000,
    extensions: {
      prf: {
        eval: {
          first: prfSaltBuffer
        }
      }
    } as AuthenticationExtensionsClientInputs
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: getOptions,
      // "optional" allows browser to show passkey picker UI
      mediation: "optional"
    }) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error("Authentication returned null");
    }

    // Extract credential ID from the assertion
    const credentialId = bufferToBase64(assertion.rawId);
    
    // Store the credential ID for future convenience (but not required)
    storeCredentialId(credentialId);

    // Extract PRF result
    const extensionResults = assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    };

    if (!extensionResults.prf?.results?.first) {
      throw new Error(
        "PRF extension did not return a result. " +
        "Your passkey may not support the PRF extension."
      );
    }

    const secret = extensionResults.prf.results.first;

    // Validate secret length (should be 32 bytes)
    if (secret.byteLength !== 32) {
      throw new Error(`Unexpected PRF output length: ${secret.byteLength} (expected 32)`);
    }

    console.log("PRF secret derived via discoverable credentials");
    return {
      secret,
      credentialId
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey authentication was cancelled or timed out");
      }
      if (error.name === "SecurityError") {
        throw new Error("Security error during passkey authentication");
      }
    }
    throw error;
  }
}

/**
 * Create a new passkey OR authenticate with existing one and derive secret
 * 
 * This is the main entry point for the passkey flow:
 * 1. First, try discoverable credential flow (shows all available passkeys)
 * 2. If no passkey found or user cancels, offer to create a new one
 * 
 * @param forceCreate - If true, skip authentication attempt and create new passkey
 * @returns The PRF-derived secret
 */
export async function getOrCreatePasskeySecret(forceCreate: boolean = false): Promise<PRFResult> {
  if (!forceCreate) {
    try {
      // Try discoverable credential flow first
      // This will show any available passkeys (synced, from Keychain, or via QR)
      console.log("Attempting discoverable credential authentication...");
      return await authenticateWithAnyPasskey();
    } catch (error) {
      // If user explicitly cancelled, propagate the error
      if (error instanceof Error && error.message.includes("cancelled")) {
        throw error;
      }
      // Otherwise, fall through to create new passkey
      console.log("No existing passkey found or authentication failed, will create new one");
    }
  }

  // Generate a random user ID for privacy
  // (World ID provides the actual uniqueness guarantee)
  const userId = crypto.getRandomValues(new Uint8Array(32));
  const credentialId = await createPasskeyCredential(userId);

  // Now authenticate to get the PRF secret
  return await deriveSecretFromPasskey(credentialId);
}
