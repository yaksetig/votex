
import circomlibjs from 'circomlibjs'

export interface BabyJubjubKeypair {
  pubKey: string[];
  privKey: string;
}

export const KEYPAIR_STORAGE_KEY = 'votex_baby_jubjub_keypair'

// Initialize the Baby Jubjub curve
let babyJub: any = null
const initBabyJub = async () => {
  if (!babyJub) {
    babyJub = await circomlibjs.buildBabyjub()
  }
  return babyJub
}

// Generate a new keypair
export const generateKeypair = async (): Promise<BabyJubjubKeypair> => {
  const babyJub = await initBabyJub()
  
  // Generate random private key
  const privKey = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256)))
  
  // Derive public key
  const pubKey = babyJub.mulPointEscalar(babyJub.Base8, privKey)
  
  const keypair = {
    pubKey: [pubKey[0].toString(), pubKey[1].toString()],
    privKey: Buffer.from(privKey).toString('hex')
  }
  
  return keypair
}

// Store keypair in local storage
export const storeKeypair = (keypair: BabyJubjubKeypair): void => {
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair))
}

// Retrieve keypair from local storage
export const retrieveKeypair = (): BabyJubjubKeypair | null => {
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY)
  if (!stored) return null
  return JSON.parse(stored)
}

// Sign a message using the Baby Jubjub keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeypair): Promise<string> => {
  const babyJub = await initBabyJub()
  const msgHash = babyJub.F.e(message)
  const privKeyBuf = Buffer.from(keypair.privKey, 'hex')
  
  // Sign the message
  const signature = babyJub.signPoseidon(privKeyBuf, msgHash)
  
  return JSON.stringify({
    R8: [signature.R8[0].toString(), signature.R8[1].toString()],
    S: signature.S.toString()
  })
}
