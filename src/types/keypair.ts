
export interface KeypairResult {
  k: bigint;
  Ax: bigint;
  Ay: bigint;
}

export interface StoredKeypair {
  k: string;
  Ax: string;
  Ay: string;
}

// New types for passkey-derived keys

/**
 * A keypair derived from passkey PRF output
 * IMPORTANT: sk should NEVER be stored - only kept in memory during use
 */
export interface DerivedKeypair {
  sk: bigint;  // Private key - NEVER STORE
  pk: {
    x: bigint;
    y: bigint;
  };
}

/**
 * Public key only - safe to store and transmit
 */
export interface PublicKey {
  x: bigint;
  y: bigint;
}

/**
 * Public key in string format for storage
 */
export interface StoredPublicKey {
  x: string;
  y: string;
}

/**
 * Passkey credential metadata (NOT the secret)
 */
export interface PasskeyCredential {
  credentialId: string;  // Base64 encoded credential ID
  createdAt: number;
}

/**
 * World ID verification result bound to a public key
 */
export interface BoundWorldIDProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: string;
  signal: string;  // Hash(pk) - binds the proof to the public key
}
