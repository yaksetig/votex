import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ElectionAuthorityInterface from './ElectionAuthorityInterface';
import ElectionEditForm from './ElectionEditForm';
import ElectionAuditLog from './ElectionAuditLog';
import TallyResultsDisplay from './TallyResultsDisplay';
import { 
  closeElectionEarly, 
  isElectionSafeToEdit, 
  getElectionAuditLog
} from '@/services/electionManagementService';
import { 
  Calendar, 
  Users, 
  Vote, 
  Clock, 
  Settings, 
  History, 
  Calculator,
  StopCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface ElectionManagementProps {
  electionId: string;
  authorityId: string;
}

interface ElectionDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  end_date: string;
  closed_manually_at?: string;
  option1: string;
  option2: string;
  authority_id: string;
}

interface VoteStats {
  total_votes: number;
  option1_count: number;
  option2_count: number;
  tally_processed: boolean;
}

// Import the AuditLogEntry interface from ElectionAuditLog component
interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  details?: any;
  performed_at: string;
}

const ElectionManagement: React.FC<ElectionManagementProps> = ({
  electionId,
  authorityId,
}) => {
  const [electionDetails, setElectionDetails] = useState<ElectionDetails | null>(null);
  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosingElection, setIsClosingElection] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Fetch election details and stats
  const fetchElectionData = async () => {
    try {
      setLoading(true);

      // Fetch election details
      const { data: election, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', electionId)
        .eq('authority_id', authorityId)
        .single();

      if (electionError) {
        throw new Error('Failed to fetch election details');
      }

      setElectionDetails(election);

      // Fetch vote statistics
      const { data: votes, error: voteError } = await supabase
        .from('votes')
        .select('choice')
        .eq('election_id', electionId);

      if (voteError) {
        console.error('Error fetching votes:', voteError);
        setVoteStats({
          total_votes: 0,
          option1_count: 0,
          option2_count: 0,
          tally_processed: false
        });
      } else {
        const option1Count = votes?.filter(v => v.choice === 'option1').length || 0;
        const option2Count = votes?.filter(v => v.choice === 'option2').length || 0;

        // Check if tally has been processed
        const { data: tallyData } = await supabase
          .from('election_tallies')
          .select('id')
          .eq('election_id', electionId)
          .single();

        setVoteStats({
          total_votes: votes?.length || 0,
          option1_count: option1Count,
          option2_count: option2Count,
          tally_processed: !!tallyData
        });
      }

      // Fetch audit log - use empty array for now since audit functionality needs to be properly implemented
      setAuditLog([]);

    } catch (error) {
      console.error('Error fetching election data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch election data"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElectionData();
  }, [electionId, authorityId]);

  const handleCloseElection = async () => {
    if (!electionDetails) return;

    try {
      setIsClosingElection(true);
      
      const success = await closeElectionEarly(electionId, authorityId);
      
      if (success) {
        toast({
          title: "Election closed successfully",
          description: "The election has been closed early."
        });
        
        // Refresh election data
        await fetchElectionData();
      } else {
        throw new Error("Failed to close election");
      }
    } catch (error) {
      console.error('Error closing election:', error);
      toast({
        variant: "destructive",
        title: "Error closing election",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsClosingElection(false);
    }
  };

  const getStatusBadge = (status: string, endDate: string, closedAt?: string) => {
    if (closedAt) {
      return <Badge variant="secondary">Closed Manually</Badge>;
    }
    
    const now = new Date();
    const end = new Date(endDate);
    
    if (now > end) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    return <Badge variant="default">Active</Badge>;
  };

  const canCloseElection = () => {
    if (!electionDetails) return false;
    
    const now = new Date();
    const endDate = new Date(electionDetails.end_date);
    
    return !electionDetails.closed_manually_at && now <= endDate;
  };

  const canEditElection = async () => {
    if (!electionDetails) return false;
    return await isElectionSafeToEdit(electionId);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!electionDetails) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Election not found or you don't have permission to manage this election.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Election Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{electionDetails.title}</h1>
            {getStatusBadge(electionDetails.status, electionDetails.end_date, electionDetails.closed_manually_at)}
          </div>
          <p className="text-muted-foreground">{electionDetails.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchElectionData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canCloseElection() && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCloseElection}
              disabled={isClosingElection}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              {isClosingElection ? 'Closing...' : 'Close Election'}
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Overview */}
      {voteStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Votes</p>
                  <p className="text-2xl font-bold">{voteStats.total_votes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Vote className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">{electionDetails.option1}</p>
                  <p className="text-2xl font-bold text-blue-600">{voteStats.option1_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Vote className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">{electionDetails.option2}</p>
                  <p className="text-2xl font-bold text-green-600">{voteStats.option2_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Tally Status</p>
                  <p className="text-sm font-semibold">
                    {voteStats.tally_processed ? 'Processed' : 'Pending'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Calendar className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="results">
            <Calculator className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="tally">
            <Calculator className="h-4 w-4 mr-2" />
            Process Tally
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Election Details</CardTitle>
              <CardDescription>Basic information about this election</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p>{new Date(electionDetails.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p>{new Date(electionDetails.end_date).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Option 1</label>
                  <p>{electionDetails.option1}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Option 2</label>
                  <p>{electionDetails.option2}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <TallyResultsDisplay 
            electionId={electionId}
            electionTitle={electionDetails.title}
            option1Name={electionDetails.option1}
            option2Name={electionDetails.option2}
          />
        </TabsContent>

        <TabsContent value="tally">
          <ElectionAuthorityInterface
            electionId={electionId}
            electionTitle={electionDetails.title}
            onTallyComplete={fetchElectionData}
          />
        </TabsContent>

        <TabsContent value="settings">
          <ElectionEditForm
            election={electionDetails}
            safeToEdit={true}
            onElectionUpdated={fetchElectionData}
          />
        </TabsContent>

        <TabsContent value="audit">
          <ElectionAuditLog auditLog={auditLog} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ElectionManagement;