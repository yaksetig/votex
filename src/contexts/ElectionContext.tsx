
import React, { createContext, useContext } from 'react';
import { ElectionContextType } from './ElectionContextTypes';
import { Election } from '@/types/election';

// Create the context with a default empty implementation
export const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  loading: true,
  createElection: async (title, description, endDate, option1, option2) => {
    return {} as Election; // Return an empty object cast as Election to match the type
  },
  castVote: async () => false,
  userHasVoted: async () => false,
  getVoteCount: () => ({ option1: 0, option2: 0 }),
  refreshElections: async () => {},
});

// Custom hook for easier context usage
export const useElections = () => {
  const context = useContext(ElectionContext);
  
  if (context === undefined) {
    throw new Error('useElections must be used within an ElectionProvider');
  }
  
  return context;
};
