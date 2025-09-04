
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
import { formatDistanceToNow, isPast } from "date-fns";
import { EyeIcon, CheckCircle, XCircle, TrendingUp, Users, Calendar, Clock, Vote } from "lucide-react";
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
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-slate-700 bg-slate-800 shadow-lg rounded-3xl overflow-hidden animate-pulse">
            <CardHeader className="p-8">
              <div className="h-6 bg-slate-700 rounded-lg mb-4"></div>
              <div className="h-4 bg-slate-600 rounded-lg"></div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="h-20 bg-slate-600 rounded-lg mb-4"></div>
              <div className="h-8 bg-slate-600 rounded-lg"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Vote className="h-12 w-12 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">No Elections Available</h3>
          <p className="text-slate-300 text-lg leading-relaxed">
            Be the first to create an election and start the democratic process!
          </p>
        </div>
      </div>
    );
  }

  const viewElection = (id: string) => {
    navigate(`/elections/${id}`);
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {elections.map((election) => {
        const endDate = new Date(election.end_date);
        const isExpired = isPast(endDate);
        const voteData = voteCounts[election.id];

        return (
          <Card key={election.id} className="group border-slate-700 bg-slate-800 hover:bg-slate-750 shadow-lg hover:shadow-2xl transition-all duration-500 rounded-3xl overflow-hidden transform hover:-translate-y-2">
            <CardHeader className="p-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold text-white mb-3 line-clamp-2 group-hover:text-purple-400 transition-colors">
                    {election.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mb-2">
                    {isExpired ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-red-900/50 text-red-300 rounded-full text-sm font-medium border border-red-800">
                        <XCircle className="h-4 w-4" />
                        Completed
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-sm font-medium border border-green-800">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Active
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="h-4 w-4" />
                {isExpired 
                  ? `Ended ${formatDistanceToNow(endDate, { addSuffix: true })}` 
                  : `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`}
              </div>
            </CardHeader>
            
            <CardContent className="px-8 pb-6">
              <p className="text-slate-300 text-sm line-clamp-3 mb-6 leading-relaxed">
                {election.description}
              </p>
              
              {/* Voting Options Preview */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl border border-blue-800/50">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-200">{election.option1}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-800/50">
                  <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                  <span className="text-sm font-medium text-purple-200">{election.option2}</span>
                </div>
              </div>
              
              {/* Vote Distribution */}
              {voteData && voteData.total > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{voteData.option1} votes ({voteData.option1Percentage}%)</span>
                    <span>{voteData.option2} votes ({voteData.option2Percentage}%)</span>
                  </div>
                  
                  {/* Dual-color progress bar */}
                  <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                    {/* Option1 (blue) portion */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${voteData.option1Percentage}%` }}
                    ></div>
                    {/* Option2 (purple) portion */}
                    <div 
                      className="absolute right-0 top-0 h-full bg-gradient-to-r from-purple-500 to-pink-600 transition-all duration-500"
                      style={{ width: `${voteData.option2Percentage}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-700/50 rounded-lg py-2">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{voteData.total} total vote{voteData.total !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400">
                    {votesLoading ? "Loading votes..." : "No votes yet"}
                  </p>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="p-8 pt-0">
              <Button 
                onClick={() => viewElection(election.id)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                {isExpired ? "View Results" : "Vote Now"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};

export default ElectionsList;
