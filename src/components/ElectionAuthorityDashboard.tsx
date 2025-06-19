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
  Calendar, Users, Edit, AlertTriangle, CheckCircle, Clock, Activity, Lock, FileCheck, FileX, BarChart3, Settings, Shield, TrendingUp
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
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          <FileCheck className="mr-1 h-3 w-3" />
          Tallied
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
          <FileX className="mr-1 h-3 w-3" />
          Pending Tally
        </Badge>
      );
    }
  };

  const getStatusBadge = (isManuallyClosed: boolean, isNaturallyClosed: boolean, isElectionEnded: boolean) => {
    if (isManuallyClosed) {
      return (
        <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
          <Lock className="mr-1 h-3 w-3" />
          Manually Closed
        </Badge>
      );
    } else if (isNaturallyClosed) {
      return (
        <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="mr-1 h-3 w-3" />
          Closed
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <Activity className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto py-12 px-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <div className="text-lg font-medium text-gray-900">Loading election dashboard...</div>
              <div className="text-sm text-gray-500">Fetching election data and permissions</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto py-12 px-6">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Election not found'}</AlertDescription>
          </Alert>
        </div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto py-8 px-6 space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
            <div className="flex items-center justify-between text-white">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{election.title}</h1>
                    <p className="text-blue-100 text-sm">{election.description}</p>
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
                    className="bg-red-500 hover:bg-red-600 border-0"
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
          
          {/* Election Details Cards */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-600 mb-1">Voting Options</div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">1. {election.option1}</div>
                        <div className="text-sm font-semibold text-gray-900">2. {election.option2}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-emerald-50 to-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-600 mb-1">Timeline</div>
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          <span className="font-medium">Created:</span> {new Date(election.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-900">
                          <span className="font-medium">Ends:</span> {new Date(election.end_date).toLocaleDateString()}
                        </div>
                        {election.closed_manually_at && (
                          <div className="text-sm text-red-600 font-medium">
                            Closed: {new Date(election.closed_manually_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-purple-50 to-violet-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Activity className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-600 mb-1">Authority</div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {election.election_authorities?.name || 'Default Authority'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Last Modified: {election.last_modified_at ? 
                            new Date(election.last_modified_at).toLocaleString() : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </div>
          </div>
        </div>

        {/* Management Tabs */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <Tabs defaultValue="overview" className="w-full">
            <div className="border-b border-gray-100 bg-gray-50/50">
              <TabsList className="h-auto p-2 bg-transparent w-full justify-start gap-1">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  Overview & Results
                </TabsTrigger>
                <TabsTrigger 
                  value="edit" 
                  disabled={!canEdit}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm disabled:opacity-50"
                >
                  <Settings className="h-4 w-4" />
                  Edit Election
                  {!canEdit && <Lock className="h-3 w-3" />}
                </TabsTrigger>
                <TabsTrigger 
                  value="tally"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
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
                <Alert className="border-amber-200 bg-amber-50">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Editing is disabled because this election has been closed. 
                    {isManuallyClosed && " The election was manually closed by an authority."}
                    {isNaturallyClosed && !isManuallyClosed && " The election has ended."}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {!safeToEdit && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
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
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <Lock className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Tally processing is disabled while the election is still active. The election must be closed or expired before tallying can be performed.
                  </AlertDescription>
                </Alert>
              )}
              
              {tallyProcessed && tallyStats ? (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle className="h-5 w-5" />
                      Tally Already Processed
                    </CardTitle>
                    <CardDescription className="text-emerald-700">
                      The tally for this election has already been processed and cannot be run again.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="border-emerald-300 bg-emerald-100">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-800">
                        Tally processing completed on {new Date(tallyStats.processedAt).toLocaleString()}
                        {tallyStats.processedBy && ` by ${tallyStats.processedBy}`}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-0 bg-white/50">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{tallyStats.totalVoters}</div>
                            <div className="text-sm text-gray-600">Total Voters</div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="border-0 bg-white/50">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{tallyStats.nullifiedVotes}</div>
                            <div className="text-sm text-gray-600">Nullified Votes</div>
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
                <Card className="border-gray-200 bg-gray-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-700">
                      <Lock className="h-5 w-5" />
                      Tally Processing Unavailable
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Tally processing will become available once the election is closed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
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
