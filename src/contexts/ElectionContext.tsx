
import React, { createContext, useContext } from 'react';
import { ElectionContextType } from './ElectionContextTypes';

// Create the context with a default empty implementation
export const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  loading: true,
  createElection: async () => {},
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
