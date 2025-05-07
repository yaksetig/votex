
import { Election, VoteCount } from "@/types/election"

export interface ElectionContextType {
  elections: Election[]
  loading: boolean
  createElection: (title: string, description: string, endDate: Date, option1: string, option2: string) => Promise<void>
  castVote: (electionId: string, choice: string) => Promise<boolean>
  userHasVoted: (electionId: string) => Promise<boolean>
  getVoteCount: (electionId: string) => VoteCount
  refreshElections: () => Promise<void>
}
