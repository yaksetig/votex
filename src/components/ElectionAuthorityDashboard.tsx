
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
import ElectionAuditLog from '@/components/ElectionAuditLog';
import { 
  Calendar, Users, Edit, AlertTriangle, CheckCircle, Clock, Activity, Lock
} from 'lucide-react';
import { isPast } from 'date-fns';
import { 
  closeElectionEarly,
  isElectionSafeToEdit,
  getElectionAuditLog
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
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchElectionData();
    checkEditSafety();
    fetchAuditLog();
  }, [electionId]);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching election data for:', electionId);
      
      // First fetch the election data
      const { data: electionData, error: fetchError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', electionId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching election:', fetchError);
        throw fetchError;
      }

      if (!electionData) {
        setError('Election not found');
        return;
      }

      console.log('Raw election data:', electionData);

      // Then fetch the election authority data separately if needed
      let enrichedElection = electionData;
      
      if (electionData.authority_id) {
        const { data: authorityData, error: authorityError } = await supabase
          .from('election_authorities')
          .select('*')
          .eq('id', electionData.authority_id)
          .maybeSingle();
          
        if (!authorityError && authorityData) {
          enrichedElection = {
            ...electionData,
            election_authorities: authorityData
          };
        }
      }

      console.log('Enriched election data:', enrichedElection);
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

  const fetchAuditLog = async () => {
    const log = await getElectionAuditLog(electionId);
    setAuditLog(log);
  };

  const handleCloseElection = async () => {
    if (!window.confirm('Are you sure you want to close this election early? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClosing(true);
      console.log('Attempting to close election:', electionId);
      
      const success = await closeElectionEarly(electionId);
      
      if (success) {
        console.log('Election closed successfully, refreshing data...');
        
        toast({
          title: "Election closed",
          description: "The election has been closed early and voting is now disabled.",
        });
        
        // Force a complete refresh of all data
        await Promise.all([
          fetchElectionData(),
          fetchAuditLog(),
          checkEditSafety()
        ]);
        
        console.log('Data refresh completed after closing election');
      } else {
        throw new Error("Failed to close election");
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
    fetchElectionData();
    checkEditSafety();
    fetchAuditLog();
  };

  const handleTallyComplete = () => {
    fetchAuditLog();
    fetchElectionData(); // Also refresh election data to update any cached values
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

  // Fixed election status logic
  const isManuallyClosed = election.status === 'closed_manually' || election.closed_manually_at;
  const isExpired = isPast(new Date(election.end_date));
  const isElectionEnded = isManuallyClosed || election.status === 'expired' || isExpired;
  const canEdit = !isElectionEnded; // Disable editing after any type of closure

  console.log('Election status check:', {
    status: election.status,
    closed_manually_at: election.closed_manually_at,
    isManuallyClosed,
    isExpired,
    isElectionEnded,
    canEdit,
    end_date: election.end_date
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
                {isManuallyClosed ? "Manually Closed" : isExpired ? "Expired" : "Active"}
              </Badge>
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
                <div className="text-sm">End Date: {new Date(election.end_date).toLocaleDateString()}</div>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit" disabled={!canEdit}>
            <div className="flex items-center gap-1">
              Edit Election
              {!canEdit && <Lock className="h-3 w-3" />}
            </div>
          </TabsTrigger>
          <TabsTrigger value="tally">Process Tally</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <TallyResultsDisplay
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
                {isExpired && !isManuallyClosed && " The election has expired."}
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
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This election is still active. Tally processing is recommended after the election ends.
              </AlertDescription>
            </Alert>
          )}
          <ElectionAuthorityInterface
            electionId={election.id}
            electionTitle={election.title}
            onTallyComplete={handleTallyComplete}
          />
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-4">
          <ElectionAuditLog auditLog={auditLog} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ElectionAuthorityDashboard;
