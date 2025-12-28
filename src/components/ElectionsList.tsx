
import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, isPast } from "date-fns";
import { EyeIcon, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Election {
  id: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  end_date: string;
  created_at: string;
}

interface ElectionsListProps {
  elections: Election[];
  loading: boolean;
}

interface VoteCounts {
  [electionId: string]: {
    option1: number;
    option2: number;
    total: number;
    option1Percentage: number;
    option2Percentage: number;
  };
}

const ElectionsList: React.FC<ElectionsListProps> = ({ elections, loading }) => {
  const navigate = useNavigate();
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [votesLoading, setVotesLoading] = useState(false);

  useEffect(() => {
    if (elections.length > 0) {
      fetchVoteCounts();
    }
  }, [elections]);

  const fetchVoteCounts = async () => {
    if (elections.length === 0) return;
    
    try {
      setVotesLoading(true);
      
      // Fetch all votes for all elections
      const { data: votes, error } = await supabase
        .from("votes")
        .select("election_id, choice")
        .in("election_id", elections.map(e => e.id));
        
      if (error) throw error;
      
      // Process vote counts for each election
      const counts: VoteCounts = {};
      
      elections.forEach(election => {
        const electionVotes = votes?.filter(vote => vote.election_id === election.id) || [];
        const option1Count = electionVotes.filter(vote => vote.choice === election.option1).length;
        const option2Count = electionVotes.filter(vote => vote.choice === election.option2).length;
        const total = option1Count + option2Count;
        const option1Percentage = total > 0 ? Math.round((option1Count / total) * 100) : 0;
        const option2Percentage = total > 0 ? Math.round((option2Count / total) * 100) : 0;
        
        counts[election.id] = {
          option1: option1Count,
          option2: option2Count,
          total,
          option1Percentage,
          option2Percentage
        };
      });
      
      setVoteCounts(counts);
    } catch (error) {
      console.error("Error fetching vote counts:", error);
    } finally {
      setVotesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-pulse h-6 w-24 bg-muted rounded mx-auto"></div>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <Card className="text-center py-10">
        <CardContent>
          <p className="text-muted-foreground">No elections found. Create one to get started!</p>
        </CardContent>
      </Card>
    );
  }

  const viewElection = (id: string) => {
    navigate(`/elections/${id}`);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {elections.map((election) => {
        const endDate = new Date(election.end_date);
        const isExpired = isPast(endDate);
        const voteData = voteCounts[election.id];

        return (
          <Card key={election.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{election.title}</span>
                {isExpired ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                {isExpired 
                  ? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}` 
                  : `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                {election.description}
              </p>
              
              {/* Vote Distribution Bar */}
              {voteData && voteData.total > 0 ? (
              <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      {election.option1}: {voteData.option1} ({voteData.option1Percentage}%)
                    </span>
                    <span className="flex items-center gap-1">
                      {election.option2}: {voteData.option2} ({voteData.option2Percentage}%)
                      <span className="w-2 h-2 rounded-full bg-muted"></span>
                    </span>
                  </div>
                  <Progress value={voteData.option1Percentage} className="h-2" />
                  <div className="text-center text-xs text-muted-foreground">
                    {voteData.total} vote{voteData.total !== 1 ? 's' : ''} total
                  </div>
                </div>
              ) : (
                <div className="mb-4 text-center text-xs text-muted-foreground">
                  {votesLoading ? "Loading votes..." : "No votes yet"}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => viewElection(election.id)}
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                View Election
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};

export default ElectionsList;
