
import { Election, VoteCount } from "@/types/election";

export const userHasVoted = (election: Election | undefined, address: string | null): boolean => {
  if (!address || !election) return false;
  return election.votes.some((vote) => vote.voter === address);
};

export const getVoteCount = (election: Election | undefined): VoteCount => {
  if (!election) return { option1: 0, option2: 0 };
  
  const option1Count = election.votes.filter((vote) => vote.choice === election.option1).length;
  const option2Count = election.votes.filter((vote) => vote.choice === election.option2).length;
  
  return { option1: option1Count, option2: option2Count };
};
