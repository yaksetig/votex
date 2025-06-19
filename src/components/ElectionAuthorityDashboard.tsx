import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import ElectionAuthorityInterface from '@/components/ElectionAuthorityInterface';
import TallyResultsDisplay from '@/components/TallyResultsDisplay';
import ElectionEditForm from '@/components/ElectionEditForm';
import { 
  Calendar, Users, Edit, AlertTriangle, CheckCircle, Clock, Activity, Lock, FileCheck, FileX
} from 'lucide-react';
import { isPast } from 'date-fns';
import { 
  closeElectionEarly,
  isElectionSafeToEdit
} from '@/services/electionManagementService';

interface ElectionAuthorityDashboardProps {
  electionId: string;
  onLogout: () => void;
}

const ElectionAuthorityDashboard: React.FC<ElectionAuthorityDashboardProps> = ({
  electionId,
  onLogout
}) => {
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safeToEdit, setSafeToEdit] = useState(false);
  const [tallyProcessed, setTallyProcessed] = useState(false);
  const [tallyStats, setTallyStats] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchElectionData();
    checkEditSafety();
    checkTallyStatus();
  }, [electionId, refreshKey]);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching election data for:', electionId);
      
      // Fetch election data with detailed logging
      const { data: electionData, error: fetchError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', electionId)
        .single();

      if (fetchError) {
        console.error('Error fetching election:', fetchError);
        throw fetchError;
      }

      if (!electionData) {
        setError('Election not found');
        return;
      }

      console.log('Fetched election data:', electionData);

      // Fetch authority data if needed
      let enrichedElection = electionData;
      
      if (electionData.authority_id) {
        const { data: authorityData, error: authorityError } = await supabase
          .from('election_authorities')
          .select('*')
          .eq('id', electionData.authority_id)
          .single();
          
        if (!authorityError && authorityData) {
          enrichedElection = {
            ...electionData,
            election_authorities: authorityData
          };
        }
      }

      console.log('Final enriched election data:', enrichedElection);
      setElection(enrichedElection);
    } catch (err) {
      console.error('Error fetching election:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkEditSafety = async () => {
    const safe = await isElectionSafeToEdit(electionId);
    setSafeToEdit(safe);
  };

  const checkTallyStatus = async () => {
    try {
      console.log('Checking tally status for election:', electionId);
      
      const { data: tallyData, error } = await supabase
        .from('election_tallies')
        .select('*')
        .eq('election_id', electionId)
        .limit(1);

      if (error) {
        console.error('Error checking tally status:', error);
        return;
      }

      if (tallyData && tallyData.length > 0) {
        setTallyProcessed(true);
        
        // Calculate stats
        const totalVoters = tallyData.length;
        const nullifiedVotes = tallyData.filter(t => t.vote_nullified).length;
        const processedAt = tallyData[0].processed_at;
        const processedBy = tallyData[0].processed_by;
        
        setTallyStats({
          totalVoters,
          nullifiedVotes,
          processedAt,
          processedBy
        });
        
        console.log('Tally already processed:', { totalVoters, nullifiedVotes, processedAt });
      } else {
        setTallyProcessed(false);
        setTallyStats(null);
        console.log('Tally not yet processed');
      }
    } catch (error) {
      console.error('Error in checkTallyStatus:', error);
    }
  };

  const handleCloseElection = async () => {
    if (!window.confirm('Are you sure you want to close this election early? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClosing(true);
      console.log('Starting election closure process...');
      
      const success = await closeElectionEarly(electionId);
      
      if (success) {
        console.log('Election closed successfully, triggering data refresh...');
        
        toast({
          title: "Election closed",
          description: "The election has been closed early and voting is now disabled.",
        });
        
        // Force a complete refresh by updating the refresh key
        setRefreshKey(prev => prev + 1);
        
        console.log('Data refresh triggered');
      } else {
        throw new Error("Failed to close election - check console for details");
      }
    } catch (error) {
      console.error('Error closing election:', error);
      toast({
        variant: "destructive",
        title: "Error closing election",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleElectionUpdated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleTallyComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getTallyBadge = (processed: boolean) => {
    if (processed) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
          <FileCheck className="mr-1 h-3 w-3" />
          Tallied
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <FileX className="mr-1 h-3 w-3" />
          Pending Tally
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center">
          <div className="text-lg">Loading election dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Election not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Improved election status logic with detailed logging
  console.log('Determining election status:', {
    status: election.status,
    closed_manually_at: election.closed_manually_at,
    end_date: election.end_date,
    current_time: new Date().toISOString()
  });

  const isManuallyClosed = election.status === 'closed_manually' || !!election.closed_manually_at;
  const isNaturallyClosed = !isManuallyClosed && isPast(new Date(election.end_date));
  const isElectionEnded = isManuallyClosed || isNaturallyClosed;
  const canEdit = !isElectionEnded;

  console.log('Election status determination:', {
    isManuallyClosed,
    isNaturallyClosed,
    isElectionEnded,
    canEdit
  });

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Election Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {election.title}
            </span>
            <div className="flex gap-2">
              <Badge variant={isElectionEnded ? "destructive" : "default"}>
                {isManuallyClosed ? "Manually Closed" : isNaturallyClosed ? "Closed" : "Active"}
              </Badge>
              {getTallyBadge(tallyProcessed)}
              {!isElectionEnded && (
                <Button 
                  onClick={handleCloseElection}
                  disabled={isClosing}
                  variant="destructive"
                  size="sm"
                >
                  {isClosing ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Closing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Close Early
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardTitle>
          <CardDescription>{election.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Options
              </div>
              <div className="space-y-1">
                <div className="text-sm">Option 1: {election.option1}</div>
                <div className="text-sm">Option 2: {election.option2}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Timeline
              </div>
              <div>
                <div className="text-sm">Created: {new Date(election.created_at).toLocaleDateString()}</div>
                <div className="text-sm">Original End Date: {new Date(election.end_date).toLocaleDateString()}</div>
                {election.closed_manually_at && (
                  <div className="text-sm text-red-600">
                    Closed Early: {new Date(election.closed_manually_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-4 w-4" />
                Authority
              </div>
              <div>
                <div className="text-sm font-medium">
                  {election.election_authorities?.name || 'Default Election Authority'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last Modified: {election.last_modified_at ? 
                    new Date(election.last_modified_at).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit" disabled={!canEdit}>
            <div className="flex items-center gap-1">
              Edit Election
              {!canEdit && <Lock className="h-3 w-3" />}
            </div>
          </TabsTrigger>
          <TabsTrigger value="tally">Process Tally</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <TallyResultsDisplay
            key={refreshKey}
            electionId={election.id}
            electionTitle={election.title}
            option1Name={election.option1}
            option2Name={election.option2}
          />
        </TabsContent>
        
        <TabsContent value="edit" className="space-y-4">
          {!canEdit ? (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Editing is disabled because this election has been closed. 
                {isManuallyClosed && " The election was manually closed by an authority."}
                {isNaturallyClosed && !isManuallyClosed && " The election has ended."}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {!safeToEdit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Warning: This election already has votes. Editing certain fields may affect the integrity of the results.
                  </AlertDescription>
                </Alert>
              )}
              <ElectionEditForm
                election={election}
                safeToEdit={safeToEdit}
                onElectionUpdated={handleElectionUpdated}
              />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="tally" className="space-y-4">
          {!isElectionEnded && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Tally processing is disabled while the election is still active. The election must be closed or expired before tallying can be performed.
              </AlertDescription>
            </Alert>
          )}
          
          {tallyProcessed && tallyStats ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Tally Already Processed
                </CardTitle>
                <CardDescription>
                  The tally for this election has already been processed and cannot be run again.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Tally processing completed on {new Date(tallyStats.processedAt).toLocaleString()}
                    {tallyStats.processedBy && ` by ${tallyStats.processedBy}`}
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{tallyStats.totalVoters}</div>
                        <div className="text-sm text-muted-foreground">Total Voters</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{tallyStats.nullifiedVotes}</div>
                        <div className="text-sm text-muted-foreground">Nullified Votes</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          ) : isElectionEnded ? (
            <ElectionAuthorityInterface
              electionId={election.id}
              electionTitle={election.title}
              onTallyComplete={handleTallyComplete}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-gray-400" />
                  Tally Processing Unavailable
                </CardTitle>
                <CardDescription>
                  Tally processing will become available once the election is closed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The election is currently active and accepting votes. Tally processing is disabled to maintain election integrity. 
                    {!isManuallyClosed && !isNaturallyClosed && " You can close the election early using the 'Close Early' button above."}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ElectionAuthorityDashboard;
