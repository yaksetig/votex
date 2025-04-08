
// Define our election types
export interface Vote {
  id?: string;
  voter: string;
  choice: string;
  signature: string;
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
