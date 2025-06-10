
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
  Shield, LogOut, Calendar, Users, Edit, Settings, 
  AlertTriangle, CheckCircle, Clock, Activity
} from 'lucide-react';
import { isPast } from 'date-fns';
import { 
  clearElectionAuthoritySession,
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
      const { data, error: fetchError } = await supabase
        .from('elections')
        .select(`
          *,
          election_authorities (
            id,
            name,
            description
          )
        `)
        .eq('id', electionId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Election not found');
      } else {
        setElection(data);
      }
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

  const handleLogout = () => {
    clearElectionAuthoritySession();
    toast({
      title: "Logged out",
      description: "You have been securely logged out.",
    });
    onLogout();
  };

  const handleCloseElection = async () => {
    if (!window.confirm('Are you sure you want to close this election early? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClosing(true);
      const success = await closeElectionEarly(electionId);
      
      if (success) {
        toast({
          title: "Election closed",
          description: "The election has been closed early and voting is now disabled.",
        });
        await fetchElectionData();
        await fetchAuditLog();
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
        <Button onClick={handleLogout} className="mt-4">
          <LogOut className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>
    );
  }

  const isElectionEnded = election.status === 'closed_manually' || 
                         election.status === 'expired' || 
                         isPast(new Date(election.end_date));
  const isManuallyoClosed = election.status === 'closed_manually';

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Election Authority Dashboard</h1>
            <p className="text-muted-foreground">Secure management interface</p>
          </div>
        </div>
        <Button onClick={handleLogout} variant="outline">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

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
                {isManuallyoClosed ? "Manually Closed" : isElectionEnded ? "Ended" : "Active"}
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
                <Shield className="h-4 w-4" />
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
          <TabsTrigger value="edit">Edit Election</TabsTrigger>
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
            onTallyComplete={() => fetchAuditLog()}
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
