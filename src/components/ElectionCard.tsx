
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useElections } from "@/contexts/ElectionContext";
import { useWallet } from "@/contexts/WalletContext";
import { Election } from "@/types/election";
import { Progress } from "@/components/ui/progress";

interface ElectionCardProps {
  election: Election;
}

const ElectionCard: React.FC<ElectionCardProps> = ({ election }) => {
  const { castVote, userHasVoted, getVoteCount } = useElections();
  const { address, isWorldIDVerified } = useWallet();
  const [hasVoted, setHasVoted] = useState(false);
  const { option1, option2 } = getVoteCount(election.id);
  const totalVotes = option1 + option2;
  const option1Percentage = totalVotes > 0 ? Math.round((option1 / totalVotes) * 100) : 0;
  const isActive = new Date() < election.endDate;

  useEffect(() => {
    const checkVoteStatus = async () => {
      const voted = await userHasVoted(election.id);
      setHasVoted(voted);
    };
    
    checkVoteStatus();
  }, [election.id, userHasVoted]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleVote = async (choice: string) => {
    const success = await castVote(election.id, choice);
    if (success) {
      setHasVoted(true);
    }
  };

  return (
    <Card className="w-full overflow-hidden relative">
      <CardHeader>
        <CardTitle className="text-xl flex items-center justify-between">
          <span>{election.title}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'}`}>
              {isActive ? 'Active' : 'Ended'}
            </span>
          </div>
        </CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Created by: {election.creator.substring(0, 6)}...{election.creator.substring(38)}</p>
          <p>End date: {formatDate(election.endDate)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{election.description}</p>
        
        {totalVotes > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{election.option1}: {option1} votes</span>
              <span>{election.option2}: {option2} votes</span>
            </div>
            <Progress value={option1Percentage} className="h-2 bg-crypto-red/30">
              <div 
                className="h-full bg-crypto-green transition-all" 
                style={{ width: `${option1Percentage}%` }}
              />
            </Progress>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{option1Percentage}%</span>
              <span>Total votes: {totalVotes}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-4">
        {!hasVoted && isActive ? (
          <>
            <Button 
              className="flex-1 bg-crypto-green hover:bg-crypto-green/90"
              onClick={() => handleVote(election.option1)}
              disabled={!isWorldIDVerified}
            >
              {election.option1}
            </Button>
            <Button 
              className="flex-1 bg-crypto-red hover:bg-crypto-red/90"
              onClick={() => handleVote(election.option2)}
              disabled={!isWorldIDVerified}
            >
              {election.option2}
            </Button>
          </>
        ) : (
          <div className="w-full text-center text-sm text-muted-foreground">
            {hasVoted 
              ? "You've already voted in this election" 
              : "This election has ended"}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ElectionCard;
