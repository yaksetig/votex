
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
  Calendar, Users, Edit, AlertTriangle, CheckCircle, Clock, Activity, Lock, FileCheck, FileX, BarChart3, Settings, Shield, TrendingUp, Award, Target
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
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          <FileCheck className="mr-1 h-3 w-3" />
          Tallied
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <FileX className="mr-1 h-3 w-3" />
          Pending Tally
        </Badge>
      );
    }
  };

  const getStatusBadge = (isManuallyClosed: boolean, isNaturallyClosed: boolean, isElectionEnded: boolean) => {
    if (isManuallyClosed) {
      return (
        <Badge variant="destructive">
          <Lock className="mr-1 h-3 w-3" />
          Manually Closed
        </Badge>
      );
    } else if (isNaturallyClosed) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" />
          Closed
        </Badge>
      );
    } else {
      return (
        <Badge variant="default">
          <Activity className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-12 px-6">
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 w-16 h-16 mx-auto bg-primary/10 rounded-2xl animate-ping opacity-20"></div>
              </div>
              <div className="space-y-2">
                <div className="text-xl font-semibold text-foreground">Loading Dashboard</div>
                <div className="text-sm text-muted-foreground">Fetching election data and permissions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-12 px-6">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Election not found'}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-6 space-y-8">
        
        {/* Header Section */}
        <Card className="rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-primary px-8 py-8">
            <div className="flex items-center justify-between text-primary-foreground">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-foreground/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{election.title}</h1>
                    <p className="text-primary-foreground/80 text-lg">{election.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getTallyBadge(tallyProcessed)}
                {getStatusBadge(isManuallyClosed, isNaturallyClosed, isElectionEnded)}
                {!isElectionEnded && (
                  <Button 
                    onClick={handleCloseElection}
                    disabled={isClosing}
                    variant="destructive"
                    size="sm"
                    className="shadow-lg"
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
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 bg-card/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg">
                      <Target className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Voting Options</div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground flex items-center">
                          <Award className="h-3 w-3 mr-1 text-primary" />
                          {election.option1}
                        </div>
                        <div className="text-sm font-semibold text-foreground flex items-center">
                          <Award className="h-3 w-3 mr-1 text-primary" />
                          {election.option2}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-card/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg">
                      <Calendar className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Timeline</div>
                      <div className="space-y-1">
                        <div className="text-sm text-foreground">
                          <span className="font-medium">Created:</span> {new Date(election.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-foreground">
                          <span className="font-medium">Ends:</span> {new Date(election.end_date).toLocaleDateString()}
                        </div>
                        {election.closed_manually_at && (
                          <div className="text-sm text-destructive font-medium">
                            Closed: {new Date(election.closed_manually_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-card/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg">
                      <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Authority</div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">
                          {election.election_authorities?.name || 'Default Authority'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Modified: {election.last_modified_at ? 
                            new Date(election.last_modified_at).toLocaleString() : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </Card>

        {/* Management Tabs */}
        <Card className="border-0 shadow-xl rounded-3xl overflow-hidden">
          <Tabs defaultValue="overview" className="w-full">
            <div className="border-b bg-card/50">
              <TabsList className="h-auto p-3 bg-transparent w-full justify-start gap-2">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-md transition-all duration-300"
                >
                  <BarChart3 className="h-4 w-4" />
                  Overview & Results
                </TabsTrigger>
                <TabsTrigger 
                  value="edit" 
                  disabled={!canEdit}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-md disabled:opacity-50 transition-all duration-300"
                >
                  <Settings className="h-4 w-4" />
                  Edit Election
                  {!canEdit && <Lock className="h-3 w-3" />}
                </TabsTrigger>
                <TabsTrigger 
                  value="tally"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-md transition-all duration-300"
                >
                  <TrendingUp className="h-4 w-4" />
                  Process Tally
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="overview" className="p-8 space-y-6">
              <TallyResultsDisplay
                key={refreshKey}
                electionId={election.id}
                electionTitle={election.title}
                option1Name={election.option1}
                option2Name={election.option2}
              />
            </TabsContent>
            
            <TabsContent value="edit" className="p-8 space-y-6">
              {!canEdit ? (
                <Alert className="rounded-2xl">
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
                    <Alert variant="destructive" className="rounded-2xl">
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
            
            <TabsContent value="tally" className="p-8 space-y-6">
              {!isElectionEnded && (
                <Alert variant="destructive" className="rounded-2xl">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Tally processing is disabled while the election is still active. The election must be closed or expired before tallying can be performed.
                  </AlertDescription>
                </Alert>
              )}
              
              {tallyProcessed && tallyStats ? (
                <Card className="border-primary/20 bg-primary/5 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <CheckCircle className="h-5 w-5" />
                      Tally Already Processed
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      The tally for this election has already been processed and cannot be run again.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-primary/10 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <AlertDescription>
                        Tally processing completed on {new Date(tallyStats.processedAt).toLocaleString()}
                        {tallyStats.processedBy && ` by ${tallyStats.processedBy}`}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-0 bg-card/50 rounded-xl">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{tallyStats.totalVoters}</div>
                            <div className="text-sm text-muted-foreground">Total Voters</div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="border-0 bg-card/50 rounded-xl">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-destructive">{tallyStats.nullifiedVotes}</div>
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
                <Card className="border-border bg-card/50 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Lock className="h-5 w-5" />
                      Tally Processing Unavailable
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Tally processing will become available once the election is closed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="rounded-xl">
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
        </Card>
      </div>
    </div>
  );
};

export default ElectionAuthorityDashboard;
