
// Define our election types
export interface Vote {
  id?: string;
  voter: string; // This will now store the Baby Jubjub public key string
  choice: string;
  signature: string; // This will store the Baby Jubjub signature
  timestamp: number;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  creator: string;
  endDate: Date;
  option1: string;
  option2: string;
  votes: Vote[];
  createdAt: Date;
}

export interface VoteCount {
  option1: number;
  option2: number;
}

// Baby Jubjub specific types
export interface BabyJubjubSignature {
  R8: [string, string]; // [x, y] coordinates
  S: string; // scalar
}
