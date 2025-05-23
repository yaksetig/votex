
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow, isPast } from "date-fns";
import { ArrowLeft, AlertCircle, CheckCircle, VoteIcon, KeyRound } from "lucide-react";
import { signVote } from "@/services/signatureService";
import { getStoredKeypair } from "@/services/keypairService";
import { StoredKeypair } from "@/types/keypair";

const ElectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId } = useWallet();
  
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voteCounts, setVoteCounts] = useState({ option1: 0, option2: 0 });
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [needsKeypair, setNeedsKeypair] = useState(false);

  useEffect(() => {
    fetchElectionData();
    checkIfUserVoted();
    
    // Load keypair from localStorage
    const storedKeypair = getStoredKeypair();
    if (storedKeypair) {
      setKeypair(storedKeypair);
    } else {
      setNeedsKeypair(true);
    }
  }, [id]);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      
      // Fetch election details
      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", id)
        .single();

      if (electionError) throw electionError;
      
      if (!electionData) {
        navigate("/elections");
        return;
      }
      
      setElection(electionData);
      
      // Fetch vote counts
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("choice")
        .eq("election_id", id);
        
      if (votesError) throw votesError;
      
      // Count votes for each option
      const option1Count = votes?.filter(vote => vote.choice === electionData.option1).length || 0;
      const option2Count = votes?.filter(vote => vote.choice === electionData.option2).length || 0;
      
      setVoteCounts({
        option1: option1Count,
        option2: option2Count
      });
      
    } catch (error) {
      console.error("Error fetching election:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load election details."
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIfUserVoted = async () => {
    if (!userId || !id) return;
    
    try {
      // Check if the user has voted in this election
      const { data, error } = await supabase
        .from("votes")
        .select("*")
        .eq("election_id", id)
        .eq("voter", userId);
        
      if (error) throw error;
      
      setHasVoted(data && data.length > 0);
    } catch (error) {
      console.error("Error checking vote status:", error);
    }
  };

  const handleVote = async () => {
    if (!selectedOption || !userId || !election || !keypair) {
      if (!keypair) {
        toast({
          variant: "destructive",
          title: "Keypair Required",
          description: "Please generate a cryptographic keypair from your dashboard first."
        });
        navigate("/dashboard");
      }
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Sign the vote
      const { signature, timestamp } = await signVote(
        keypair,
        election.id,
        selectedOption
      );
      
      // Submit the vote
      const { error } = await supabase.rpc("insert_vote", {
        p_election_id: election.id,
        p_voter: userId,
        p_choice: selectedOption,
        p_nullifier: null, // We would implement nullifier for privacy
        p_signature: signature,
        p_timestamp: timestamp
      });
      
      if (error) throw error;
      
      toast({
        title: "Vote submitted",
        description: "Your vote has been recorded successfully."
      });
      
      // Update local state
      setHasVoted(true);
      fetchElectionData();
      
    } catch (error) {
      console.error("Error submitting vote:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit your vote. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-10">
          <div className="animate-pulse h-6 w-24 bg-muted rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Election not found</h3>
              <p className="mt-2 text-muted-foreground">
                The election you're looking for doesn't exist or has been removed.
              </p>
              <Button 
                className="mt-6" 
                variant="outline"
                onClick={() => navigate("/elections")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Elections
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const endDate = new Date(election.end_date);
  const isExpired = isPast(endDate);
  const totalVotes = voteCounts.option1 + voteCounts.option2;
  const option1Percentage = totalVotes > 0 ? Math.round((voteCounts.option1 / totalVotes) * 100) : 0;
  const option2Percentage = totalVotes > 0 ? Math.round((voteCounts.option2 / totalVotes) * 100) : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <Button 
        variant="ghost" 
        className="mb-4"
        onClick={() => navigate("/elections")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Elections
      </Button>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">{election.title}</CardTitle>
            <Badge variant={isExpired ? "destructive" : "default"}>
              {isExpired ? "Expired" : "Active"}
            </Badge>
          </div>
          <CardDescription>
            {isExpired 
              ? `Ended ${formatDistanceToNow(endDate, { addSuffix: true })}` 
              : `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-line">{election.description}</p>
          </div>
          
          {needsKeypair && !keypair && (
            <div className="flex flex-col items-center p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <KeyRound className="h-8 w-8 text-amber-500 mb-2" />
              <h3 className="text-lg font-medium">Keypair Required</h3>
              <p className="text-center text-muted-foreground mb-3">
                To vote securely, you need to generate a cryptographic keypair first.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
          
          {(isExpired || hasVoted) ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Results</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{election.option1}</span>
                    <span>{voteCounts.option1} votes ({option1Percentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${option1Percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{election.option2}</span>
                    <span>{voteCounts.option2} votes ({option2Percentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive" 
                      style={{ width: `${option2Percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground pt-2">
                  Total votes: {totalVotes}
                </div>
              </div>
              
              {hasVoted && (
                <div className="flex items-center justify-center p-3 bg-primary/10 rounded-md">
                  <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                  <span className="text-sm font-medium">You have voted in this election</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Cast Your Vote</h3>
              <RadioGroup 
                value={selectedOption}
                onValueChange={setSelectedOption}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={election.option1} id="option1" />
                  <Label htmlFor="option1">{election.option1}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={election.option2} id="option2" />
                  <Label htmlFor="option2">{election.option2}</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          {!isExpired && !hasVoted && (
            <Button 
              className="w-full" 
              disabled={!selectedOption || submitting || !keypair}
              onClick={handleVote}
            >
              <VoteIcon className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Vote"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ElectionDetail;
