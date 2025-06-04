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
import { 
  registerElectionParticipant, 
  getElectionParticipants, 
  ElectionParticipant,
  isUserParticipant 
} from "@/services/electionParticipantsService";
import { getElectionAuthorityForElection, initializeDefaultElectionAuthority } from "@/services/electionAuthorityService";
import { createNullificationEncryption, generateDeterministicR } from "@/services/elGamalService";
import { storeNullification } from "@/services/nullificationService";
import { generateNullificationProof } from "@/services/zkProofService";
import { hasTrustedSetup, generateKeyFileHash } from "@/services/trustedSetupService";
import TrustedSetupStatus from "@/components/TrustedSetupStatus";

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
  const [nullifying, setNullifying] = useState(false);
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [needsKeypair, setNeedsKeypair] = useState(false);
  const [participants, setParticipants] = useState<ElectionParticipant[]>([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [canNullify, setCanNullify] = useState(false);

  useEffect(() => {
    fetchElectionData();
    checkIfUserVoted();
    initializeDefaultElectionAuthority();
    
    const storedKeypair = getStoredKeypair();
    if (storedKeypair) {
      setKeypair(storedKeypair);
    } else {
      setNeedsKeypair(true);
    }
  }, [id]);

  useEffect(() => {
    if (userId && id) {
      checkParticipantStatus();
      checkNullificationAvailability();
    }
  }, [userId, id]);

  const checkNullificationAvailability = async () => {
    if (!id) return;
    
    try {
      const setupExists = await hasTrustedSetup(id);
      setCanNullify(setupExists);
    } catch (error) {
      setCanNullify(false);
    }
  };

  const checkParticipantStatus = async () => {
    if (!userId || !id) return;
    
    try {
      const participantStatus = await isUserParticipant(id, userId);
      setIsParticipant(participantStatus);
    } catch (error) {
      // Silent error handling
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
      
      const { error } = await supabase.rpc("insert_vote", {
        p_election_id: election.id,
        p_voter: userId,
        p_choice: selectedOption,
        p_nullifier: null,
        p_signature: signature,
        p_timestamp: timestamp
      });
      
      if (error) throw error;
      
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

  const handleNullifyVote = async () => {
    if (!userId || !election || !id || !keypair) return;
    
    if (!hasVoted) {
      toast({
        variant: "destructive",
        title: "Cannot Nullify",
        description: "You can only nullify your vote after you have voted."
      });
      return;
    }

    if (!canNullify) {
      toast({
        variant: "destructive",
        title: "Nullification Unavailable",
        description: "The cryptographic trusted setup has not been completed for this election."
      });
      return;
    }
    
    try {
      setNullifying(true);
      
      await ensureUserIsParticipant();
      
      const authority = await getElectionAuthorityForElection(id);
      if (!authority) {
        throw new Error("Failed to get election authority");
      }
      
      const nullificationCiphertext = await createNullificationEncryption(
        keypair,
        { x: authority.public_key_x, y: authority.public_key_y }
      );
      
      const userPublicKey = { x: BigInt(keypair.Ax), y: BigInt(keypair.Ay) };
      const deterministicR = await generateDeterministicR(BigInt(keypair.k), userPublicKey);
      
      toast({
        title: "Generating Proof",
        description: "Creating cryptographic proof for nullification using trusted setup..."
      });
      
      // TEMPORARY DEBUG: Hash the proving-key.key file and log it
      try {
        console.log("🔍 DEBUG: Computing hash of proving-key.key file...");
        const computedHash = await generateKeyFileHash('proving-key.key');
        console.log("🔍 DEBUG: Computed proving-key.key hash:", computedHash);
        console.log("🔍 DEBUG: Database stored hash: 8e3044f5be9a0dd6827ee6198344d742bd17ff73e5c0d5e79de55905150dc9e0");
        console.log("🔍 DEBUG: Hashes match:", computedHash === "8e3044f5be9a0dd6827ee6198344d742bd17ff73e5c0d5e79de55905150dc9e0");
      } catch (hashError) {
        console.error("🔍 DEBUG: Error computing proving key hash:", hashError);
      }
      
      // Fix: Pass keypair first, then authority public key, then ciphertext, then deterministicR, then election ID
      const zkProof = await generateNullificationProof(
        keypair,
        { x: authority.public_key_x, y: authority.public_key_y },
        nullificationCiphertext,
        deterministicR,
        id // Pass election ID as last parameter
      );
      
      const stored = await storeNullification(id, userId, nullificationCiphertext, zkProof);
      
      if (!stored) {
        throw new Error("Failed to store nullification");
      }
      
      toast({
        title: "Nullification Submitted",
        description: "Your nullification with cryptographic proof has been successfully recorded."
      });
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit nullification: ${error instanceof Error ? error.message : 'Please try again.'}`
      });
    } finally {
      setNullifying(false);
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
      
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Trusted Setup Status */}
        <TrustedSetupStatus electionId={election.id} isAdmin={false} />
        
        <Card>
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
                  <div className="space-y-3">
                    <div className="flex items-center justify-center p-3 bg-primary/10 rounded-md">
                      <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                      <span className="text-sm font-medium">You have voted in this election</span>
                    </div>
                    {!isExpired && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        onClick={handleNullifyVote}
                        disabled={nullifying || !canNullify}
                      >
                        {nullifying ? "Processing..." : !canNullify ? "Nullification Unavailable" : "Nullify Vote"}
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
    </div>
  );
};

export default ElectionDetail;
