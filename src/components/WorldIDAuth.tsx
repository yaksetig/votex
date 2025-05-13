import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { useElections } from '@/contexts/ElectionContext';
import { useToast } from '@/hooks/use-toast';
import { Election } from '@/types/election';

interface VoteButtonsProps {
  election: Election;
  onVoted: () => void;
}

const VoteButtons: React.FC<VoteButtonsProps> = ({ election, onVoted }) => {
  const { anonymousKeypair, userId } = useWallet();
  const { castVote } = useElections();
  const { toast } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const handleVote = async (optionIndex: number) => {
    if (!anonymousKeypair || !userId) {
      toast({
        title: "Authentication required",
        description: "You need to verify with World ID to vote.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSelectedOption(optionIndex);
      setIsVoting(true);
      
      // Cast vote using the anonymous keypair
      const success = await castVote(election.id, optionIndex);
      
      if (success) {
        toast({
          title: "Vote cast successfully",
          description: "Your anonymous vote has been recorded.",
        });
        onVoted();
      }
    } catch (error) {
      console.error("Error casting vote:", error);
      toast({
        title: "Error casting vote",
        description: "There was a problem casting your vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
      setSelectedOption(null);
    }
  };

  return (
    <div className="flex gap-4">
      <Button 
        className="flex-1 bg-crypto-green hover:bg-crypto-green/90"
        onClick={() => handleVote(0)}
        disabled={isVoting}
      >
        {isVoting && selectedOption === 0 ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Voting...
          </span>
        ) : (
          election.option1
        )}
      </Button>
      
      <Button 
        className="flex-1 bg-crypto-red hover:bg-crypto-red/90"
        onClick={() => handleVote(1)}
        disabled={isVoting}
      >
        {isVoting && selectedOption === 1 ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Voting...
          </span>
        ) : (
          election.option2
        )}
      </Button>
    </div>
  );
};

export default VoteButtons;
