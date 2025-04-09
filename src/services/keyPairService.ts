
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface SerializedKeyPair {
  publicKey: string;
  secretKey: string; 
}

// Generate a new keypair
export const generateKeypair = (): KeyPair => {
  return nacl.sign.keyPair();
};

// Store keypair in localStorage
export const storeKeypair = (keypair: KeyPair): void => {
  const serialized: SerializedKeyPair = {
    publicKey: util.encodeBase64(keypair.publicKey),
    secretKey: util.encodeBase64(keypair.secretKey)
  };
  
  localStorage.setItem('anonymous-keypair', JSON.stringify(serialized));
};

// Retrieve keypair from localStorage
export const retrieveKeypair = (): KeyPair | null => {
  const storedKeypair = localStorage.getItem('anonymous-keypair');
  
  if (!storedKeypair) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(storedKeypair) as SerializedKeyPair;
    return {
      publicKey: util.decodeBase64(parsed.publicKey),
      secretKey: util.decodeBase64(parsed.secretKey)
    };
  } catch (error) {
    console.error('Error parsing stored keypair:', error);
    return null;
  }
};

// Sign a message with a keypair
export const signWithKeypair = (message: string, keypair: KeyPair): string => {
  if (!keypair) {
    throw new Error('No keypair provided for signing');
  }
  
  const messageUint8 = util.decodeUTF8(message);
  const signature = nacl.sign.detached(messageUint8, keypair.secretKey);
  
  // Return signature in base64 format for easy storage
  return util.encodeBase64(signature);
};

// Verify a signature
export const verifySignature = (
  message: string,
  signature: string,
  publicKey: Uint8Array
): boolean => {
  const messageUint8 = util.decodeUTF8(message);
  const signatureUint8 = util.decodeBase64(signature);
  
  return nacl.sign.detached.verify(messageUint8, signatureUint8, publicKey);
};

// Get public key as string (for storage and identification)
export const getPublicKeyString = (publicKey: Uint8Array): string => {
  return util.encodeBase64(publicKey);
};

// Parse public key from string
export const parsePublicKey = (publicKeyString: string): Uint8Array => {
  return util.decodeBase64(publicKeyString);
};
