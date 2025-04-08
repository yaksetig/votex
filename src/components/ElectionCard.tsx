
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useElections, Election } from "@/contexts/ElectionContext";
import { Progress } from "@/components/ui/progress";

interface ElectionCardProps {
  election: Election;
}

const ElectionCard: React.FC<ElectionCardProps> = ({ election }) => {
  const { castVote, userHasVoted, getVoteCount } = useElections();
  const hasVoted = userHasVoted(election.id);
  const { yes, no } = getVoteCount(election.id);
  const totalVotes = yes + no;
  const yesPercentage = totalVotes > 0 ? Math.round((yes / totalVotes) * 100) : 0;
  const isActive = new Date() < election.endDate;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleVote = async (choice: "Yes" | "No") => {
    await castVote(election.id, choice);
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-xl flex items-center justify-between">
          <span>{election.title}</span>
          <span className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'}`}>
            {isActive ? 'Active' : 'Ended'}
          </span>
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
              <span>Yes: {yes} votes</span>
              <span>No: {no} votes</span>
            </div>
            <Progress value={yesPercentage} className="h-2 bg-crypto-red/30">
              <div 
                className="h-full bg-crypto-green transition-all" 
                style={{ width: `${yesPercentage}%` }}
              />
            </Progress>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{yesPercentage}%</span>
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
              onClick={() => handleVote("Yes")}
            >
              Vote Yes
            </Button>
            <Button 
              className="flex-1 bg-crypto-red hover:bg-crypto-red/90"
              onClick={() => handleVote("No")}
            >
              Vote No
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
