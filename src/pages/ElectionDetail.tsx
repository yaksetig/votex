import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { authenticateWithAnyPasskey } from "@/services/passkeyService";
import { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair } from "@/services/deterministicKeyService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow, isPast } from "date-fns";
import { ArrowLeft, AlertCircle, CheckCircle, VoteIcon, KeyRound, Fingerprint, Loader2 } from "lucide-react";
import { signVote } from "@/services/signatureService";
import { getStoredKeypair, validateAndMigrateKeypair } from "@/services/keypairService";
import { StoredKeypair } from "@/types/keypair";
import { 
  registerElectionParticipant, 
  getElectionParticipants, 
  ElectionParticipant,
  isUserParticipant 
} from "@/services/electionParticipantsService";
import { getElectionAuthorityForElection, initializeDefaultElectionAuthority } from "@/services/electionAuthorityService";
import { storeNullificationBatch } from "@/services/nullificationService";
import { generateKAnonymousNullifications, KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import NullificationDialog from "@/components/NullificationDialog";
import KAnonymityProgressDialog from "@/components/KAnonymityProgressDialog";

const ElectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId, isWorldIDVerified, derivedPublicKey, setDerivedPublicKey } = useWallet();
  
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voteCounts, setVoteCounts] = useState({ option1: 0, option2: 0 });
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nullifying, setNullifying] = useState(false);
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [needsKeypair, setNeedsKeypair] = useState(false);
  const [participants, setParticipants] = useState<ElectionParticipant[]>([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [showNullificationDialog, setShowNullificationDialog] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [nullificationProgress, setNullificationProgress] = useState<KAnonymityProgress | null>(null);

  useEffect(() => {
    fetchElectionData();
    checkIfUserVoted();
    initializeDefaultElectionAuthority();
    
    // Validate keypair consistency with current base point
    const { valid, cleared, keypair: validKeypair } = validateAndMigrateKeypair();
    if (cleared) {
      toast({
        variant: "destructive",
        title: "Keypair Outdated",
        description: "Your keypair was generated with an older version. Please generate a new one from the dashboard."
      });
      setNeedsKeypair(true);
    } else if (valid && validKeypair) {
      setKeypair(validKeypair);
    } else {
      setNeedsKeypair(true);
    }
  }, [id]);

  useEffect(() => {
    if (userId && id) {
      checkParticipantStatus();
    }
  }, [userId, id]);

  const checkParticipantStatus = async () => {
    if (!userId || !id) return;
    
    try {
      const participantStatus = await isUserParticipant(id, userId);
      setIsParticipant(participantStatus);
    } catch (error) {
      // Silent error handling
    }
  };

  // Re-derive keypair from passkey for voting
  const rederiveKeypair = async () => {
    setIsDerivingKey(true);
    try {
      const prfResult = await authenticateWithAnyPasskey();
      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair verification failed");
      }
      
      const pkStrings = publicKeyToStrings(keypair.pk);
      setDerivedPublicKey(pkStrings);
      
      // Store full keypair for voting
      const storedKeypair = {
        k: keypair.sk.toString(),
        Ax: keypair.pk.x.toString(),
        Ay: keypair.pk.y.toString()
      };
      localStorage.setItem("babyJubKeypair", JSON.stringify(storedKeypair));
      setKeypair(storedKeypair);
      setNeedsKeypair(false);
      
      toast({
        title: "Keypair derived",
        description: "You can now vote in this election.",
      });
    } catch (error) {
      console.error("Error deriving keypair:", error);
      toast({
        variant: "destructive",
        title: "Derivation failed",
        description: error instanceof Error ? error.message : "Failed to derive keypair",
      });
    } finally {
      setIsDerivingKey(false);
    }
  };

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      
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
      
      // Get vote counts from new tracking tables
      const { data: yesVotes, error: yesError } = await supabase
        .from("yes_votes")
        .select("*")
        .eq("election_id", id);
        
      const { data: noVotes, error: noError } = await supabase
        .from("no_votes")
        .select("*")
        .eq("election_id", id);
        
      if (yesError || noError) {
        console.error("Error fetching vote counts:", yesError || noError);
        // Fallback to old votes table if needed
        const { data: votes, error: votesError } = await supabase
          .from("votes")
          .select("choice")
          .eq("election_id", id);
          
        if (votesError) throw votesError;
        
        const option1Count = votes?.filter(vote => vote.choice === electionData.option1).length || 0;
        const option2Count = votes?.filter(vote => vote.choice === electionData.option2).length || 0;
        
        setVoteCounts({
          option1: option1Count,
          option2: option2Count
        });
      } else {
        // Use vote tracking tables
        const validYesVotes = yesVotes?.filter(vote => !vote.nullified).length || 0;
        const validNoVotes = noVotes?.filter(vote => !vote.nullified).length || 0;
        
        setVoteCounts({
          option1: validYesVotes,
          option2: validNoVotes
        });
      }

      if (id) {
        const participantsList = await getElectionParticipants(id);
        setParticipants(participantsList);
      }
      
    } catch (error) {
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
      const { data, error } = await supabase
        .from("votes")
        .select("*")
        .eq("election_id", id)
        .eq("voter", userId);
        
      if (error) throw error;
      
      setHasVoted(data && data.length > 0);
    } catch (error) {
      // Silent error handling
    }
  };

  const ensureUserIsParticipant = async (): Promise<boolean> => {
    if (!userId || !election || !keypair) return false;
    
    try {
      if (isParticipant) {
        return true;
      }
      
      const participantRegistered = await registerElectionParticipant(
        election.id,
        userId,
        keypair
      );
      
      if (participantRegistered) {
        setIsParticipant(true);
        const updatedParticipants = await getElectionParticipants(election.id);
        setParticipants(updatedParticipants);
      }
      
      return participantRegistered;
    } catch (error) {
      return false;
    }
  };

  const handleVote = async () => {
    // Guard: Check if election is closed (expired or manually closed)
    const electionClosed = isPast(new Date(election?.end_date)) || !!election?.closed_manually_at;
    if (electionClosed) {
      toast({
        variant: "destructive",
        title: "Election Closed",
        description: "This election is no longer accepting votes."
      });
      return;
    }
    
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
      
      const participantRegistered = await ensureUserIsParticipant();
      
      if (!participantRegistered) {
        throw new Error("Failed to register as election participant");
      }
      
      const { signature, timestamp } = await signVote(
        keypair,
        election.id,
        selectedOption
      );
      
      // Record vote in both old and new systems for compatibility
      const { error: oldVoteError } = await supabase.rpc("insert_vote", {
        p_election_id: election.id,
        p_voter: userId,
        p_choice: selectedOption,
        p_nullifier: null,
        p_signature: signature,
        p_timestamp: timestamp
      });
      
      if (oldVoteError) throw oldVoteError;
      
      // Record in new tracking table - use option1 to determine table, not hardcoded "Yes"
      const tableName = selectedOption === election.option1 ? 'yes_votes' : 'no_votes';
      const { error: newVoteError } = await supabase
        .from(tableName)
        .upsert({
          election_id: election.id,
          voter_id: userId,
          nullified: false,
          nullification_count: 0
        }, {
          onConflict: 'election_id,voter_id'
        });
      
      if (newVoteError) {
        console.error("Error recording vote in tracking table:", newVoteError);
        // Don't throw error here, vote was already recorded in main table
      }
      
      toast({
        title: "Vote submitted",
        description: "Your vote has been recorded successfully."
      });
      
      setHasVoted(true);
      fetchElectionData();
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit your vote. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const performNullification = async (isActual: boolean) => {
    if (!userId || !election || !id || !keypair) return;
    
    // Guard: Check if election is closed (expired or manually closed)
    const electionClosed = isPast(new Date(election.end_date)) || !!election.closed_manually_at;
    if (electionClosed) {
      toast({
        variant: "destructive",
        title: "Election Closed",
        description: "This election is no longer accepting nullifications."
      });
      return;
    }
    
    if (!hasVoted) {
      toast({
        variant: "destructive",
        title: "Cannot Nullify",
        description: "You can only nullify your vote after you have voted."
      });
      return;
    }
    
    try {
      setNullifying(true);
      setShowNullificationDialog(false);
      setShowProgressDialog(true);
      
      await ensureUserIsParticipant();
      
      const authority = await getElectionAuthorityForElection(id);
      if (!authority) {
        throw new Error("Failed to get election authority");
      }
      
      // Generate k-anonymous nullifications with progress tracking
      const nullificationBatch = await generateKAnonymousNullifications(
        id,
        userId,
        keypair,
        { x: authority.public_key_x, y: authority.public_key_y },
        isActual,
        6, // k = 6
        (progress) => setNullificationProgress(progress)
      );
      
      // Store all nullifications atomically
      const batchItems = nullificationBatch.map(item => ({
        userId: item.targetUserId,
        ciphertext: item.ciphertext,
        zkp: item.zkp!
      }));
      
      const stored = await storeNullificationBatch(id, batchItems);
      
      if (!stored) {
        throw new Error("Failed to store nullifications");
      }
      
      setShowProgressDialog(false);
      
      toast({
        title: `${isActual ? 'Actual' : 'Dummy'} Nullification Submitted`,
        description: `Your nullification has been recorded with k-anonymity protection (${nullificationBatch.length} proofs).`
      });
      
    } catch (error) {
      console.error("Nullification error:", error);
      setShowProgressDialog(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit nullification."
      });
    } finally {
      setNullifying(false);
      setNullificationProgress(null);
    }
  };

  const handleNullifyVote = async () => {
    setShowNullificationDialog(true);
  };

  const handleActualNullification = () => {
    performNullification(true);
  };

  const handleDummyNullification = () => {
    performNullification(false);
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
  const isElectionClosed = isExpired || !!election.closed_manually_at;
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
            <CardTitle className="text-2xl">{election?.title}</CardTitle>
            <Badge variant={isElectionClosed ? "destructive" : "default"}>
              {isElectionClosed 
                ? (election.closed_manually_at ? "Closed" : "Expired") 
                : "Active"}
            </Badge>
          </div>
          <CardDescription>
            {isElectionClosed
              ? (election.closed_manually_at 
                  ? "Closed early by authority"
                  : `Ended ${formatDistanceToNow(endDate, { addSuffix: true })}`)
              : `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-line">{election.description}</p>
          </div>
          
          {needsKeypair && !keypair && isWorldIDVerified && (
            <div className="flex flex-col items-center p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <Fingerprint className="h-8 w-8 text-amber-500 mb-2" />
              <h3 className="text-lg font-medium">Derive Your Keypair</h3>
              <p className="text-center text-muted-foreground mb-3">
                Authenticate with your passkey to derive your cryptographic keypair for voting.
              </p>
              <Button onClick={rederiveKeypair} disabled={isDerivingKey}>
                {isDerivingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deriving...
                  </>
                ) : (
                  <>
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Sign in with Passkey
                  </>
                )}
              </Button>
            </div>
          )}
          
          {needsKeypair && !keypair && !isWorldIDVerified && (
            <div className="flex flex-col items-center p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <KeyRound className="h-8 w-8 text-amber-500 mb-2" />
              <h3 className="text-lg font-medium">Sign In Required</h3>
              <p className="text-center text-muted-foreground mb-3">
                Sign in to participate in this election.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
          
          {(election && (isElectionClosed || hasVoted)) ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Results</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{election.option1}</span>
                    <span>{voteCounts.option1} votes ({voteCounts.option1 + voteCounts.option2 > 0 ? Math.round((voteCounts.option1 / (voteCounts.option1 + voteCounts.option2)) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${voteCounts.option1 + voteCounts.option2 > 0 ? Math.round((voteCounts.option1 / (voteCounts.option1 + voteCounts.option2)) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{election.option2}</span>
                    <span>{voteCounts.option2} votes ({voteCounts.option1 + voteCounts.option2 > 0 ? Math.round((voteCounts.option2 / (voteCounts.option1 + voteCounts.option2)) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive" 
                      style={{ width: `${voteCounts.option1 + voteCounts.option2 > 0 ? Math.round((voteCounts.option2 / (voteCounts.option1 + voteCounts.option2)) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground pt-2">
                  Total votes: {voteCounts.option1 + voteCounts.option2}
                </div>
              </div>
              
              {hasVoted && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center p-3 bg-primary/10 rounded-md">
                    <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                    <span className="text-sm font-medium">You have voted in this election</span>
                  </div>
                  {!isElectionClosed && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                      onClick={handleNullifyVote}
                      disabled={nullifying}
                    >
                      {nullifying ? "Processing..." : "Nullify Vote"}
                    </Button>
                  )}
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
        
        <CardFooter className="flex-col gap-4">
          {/* Sign in prompt for unauthenticated users */}
          {!isWorldIDVerified && !isElectionClosed && (
            <div className="w-full text-center p-4 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground mb-3">
                Sign in to vote in this election
              </p>
              <Button asChild>
                <Link to="/dashboard">Authenticate with World ID</Link>
              </Button>
            </div>
          )}
          
          {/* Vote button for authenticated users */}
          {election && !isElectionClosed && !hasVoted && isWorldIDVerified && (
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

      <NullificationDialog
        open={showNullificationDialog}
        onOpenChange={setShowNullificationDialog}
        onActualNullification={handleActualNullification}
        onDummyNullification={handleDummyNullification}
        isProcessing={nullifying}
      />

      <KAnonymityProgressDialog
        open={showProgressDialog}
        progress={nullificationProgress}
      />
    </div>
  );
};

export default ElectionDetail;
