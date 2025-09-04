
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { processElectionTally, ElectionTallyResult } from '@/services/tallyService';
import { supabase } from '@/integrations/supabase/client';
import { isElectionSafeToEdit } from '@/services/electionManagementService';
import { Shield, Lock, Calculator, CheckCircle, AlertTriangle, Calendar, XCircle, Users, BarChart3, Settings, StopCircle, Activity, PieChart, TrendingUp } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import ElectionEditForm from '@/components/ElectionEditForm';
import ElectionAuditLog from '@/components/ElectionAuditLog';

interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  details?: any;
  performed_at: string;
}

interface ElectionAuthorityInterfaceProps {
  electionId: string;
  electionTitle?: string;
  onTallyComplete?: (results: ElectionTallyResult) => void;
}

interface Election {
  id: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  end_date: string;
  created_at: string;
  creator: string;
  status: string;
  closed_manually_at?: string;
}

interface ElectionStats {
  totalVotes: number;
  option1Votes: number;
  option2Votes: number;
  option1Percentage: number;
  option2Percentage: number;
}

const ElectionAuthorityInterface: React.FC<ElectionAuthorityInterfaceProps> = ({
  electionId,
  electionTitle,
  onTallyComplete = () => {}
}) => {
  const [privateKey, setPrivateKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tallyResults, setTallyResults] = useState<ElectionTallyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<ElectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [safeToEdit, setSafeToEdit] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchElection();
  }, [electionId]);

  const fetchElection = async () => {
    try {
      setLoading(true);
      const { data: electionData, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', electionId)
        .single();

      if (electionError) throw electionError;
      setElection(electionData);

      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('election_id, choice')
        .eq('election_id', electionId);

      if (votesError) throw votesError;

      const option1Votes = votesData?.filter(v => v.choice === electionData.option1).length || 0;
      const option2Votes = votesData?.filter(v => v.choice === electionData.option2).length || 0;
      const totalVotes = option1Votes + option2Votes;

      setStats({
        totalVotes,
        option1Votes,
        option2Votes,
        option1Percentage: totalVotes > 0 ? Math.round((option1Votes / totalVotes) * 100) : 0,
        option2Percentage: totalVotes > 0 ? Math.round((option2Votes / totalVotes) * 100) : 0,
      });

      // Check if election is safe to edit
      const safe = await isElectionSafeToEdit(electionId);
      setSafeToEdit(safe);

      // Fetch audit log directly to get proper fields
      const { data: auditData, error: auditError } = await supabase
        .from('election_authority_audit_log')
        .select('*')
        .eq('election_id', electionId)
        .order('performed_at', { ascending: false });

      if (!auditError && auditData) {
        setAuditLog(auditData);
      }
    } catch (error) {
      console.error('Error fetching election:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch election data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessTally = async () => {
    if (!privateKey.trim()) {
      setError('Please enter the authority private key');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      
      console.log(`Processing tally for election: ${electionId}`);
      
      const results = await processElectionTally(
        electionId, 
        privateKey.trim(),
        'Election Authority' // Could be made dynamic
      );
      
      if (results) {
        setTallyResults(results);
        onTallyComplete(results);
        
        toast({
          title: "Tally processed successfully",
          description: `Processed ${results.results.length} voter records.`,
        });
      } else {
        throw new Error("Failed to process election tally");
      }
    } catch (err) {
      console.error('Error processing tally:', err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Tally processing failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      // Clear private key for security
      setPrivateKey('');
    }
  };

  const getTallyStats = () => {
    if (!tallyResults) return null;
    
    const totalVoters = tallyResults.results.length;
    const nullifiedVotes = tallyResults.results.filter(r => r.voteNullified).length;
    const totalNullifications = tallyResults.results.reduce((sum, r) => sum + r.nullificationCount, 0);
    
    return { totalVoters, nullifiedVotes, totalNullifications };
  };

  const tallyStats = getTallyStats();

  const handleCloseElection = async () => {
    try {
      const { error } = await supabase
        .from('elections')
        .update({ 
          closed_manually_at: new Date().toISOString(),
          status: 'closed_manually' 
        })
        .eq('id', electionId);

      if (error) throw error;

      toast({
        title: "Election closed",
        description: "Election has been closed early.",
      });
      
      fetchElection(); // Refresh data
    } catch (error) {
      console.error('Error closing election:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to close election.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading election details...</div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Election not found</div>
      </div>
    );
  }

  const isExpired = isPast(new Date(election.end_date));
  const isClosedManually = !!election.closed_manually_at;
  const isActive = !isExpired && !isClosedManually;

  return (
    <div className="space-y-6">
      {/* Election Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">{election.title}</CardTitle>
              <CardDescription className="text-base">{election.description}</CardDescription>
              <div className="flex items-center gap-2">
                {isClosedManually ? (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                    <StopCircle className="h-3 w-3 mr-1" />
                    Closed Early
                  </Badge>
                ) : isExpired ? (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-300">
                    <XCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse mr-1"></div>
                    Active
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {stats?.totalVotes || 0} votes
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    View Analytics
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Election Analytics - {election.title}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{stats?.totalVotes || 0}</div>
                            <div className="text-sm text-muted-foreground">Total Votes</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{stats?.option1Percentage || 0}%</div>
                            <div className="text-sm text-muted-foreground">{election.option1}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-purple-600">{stats?.option2Percentage || 0}%</div>
                            <div className="text-sm text-muted-foreground">{election.option2}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Vote Distribution</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditDialogOpen(true)}
                        className="flex items-center gap-1"
                      >
                        <Activity className="h-4 w-4" />
                        View Audit Log
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{election.option1}</span>
                          <span className="text-sm text-muted-foreground">{stats?.option1Votes || 0} votes</span>
                        </div>
                        <Progress value={stats?.option1Percentage || 0} className="h-3" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{election.option2}</span>
                          <span className="text-sm text-muted-foreground">{stats?.option2Votes || 0} votes</span>
                        </div>
                        <Progress value={stats?.option2Percentage || 0} className="h-3" />
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="flex items-center gap-1">
                    <Settings className="h-4 w-4" />
                    Edit Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Election Details</DialogTitle>
                  </DialogHeader>
                  <ElectionEditForm
                    election={election}
                    safeToEdit={safeToEdit}
                    onElectionUpdated={() => {
                      setEditDialogOpen(false);
                      fetchElection();
                    }}
                  />
                </DialogContent>
              </Dialog>

              {isActive && (
                <Button size="sm" variant="destructive" onClick={handleCloseElection} className="flex items-center gap-1">
                  <StopCircle className="h-4 w-4" />
                  Close Early
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-900">{election.option1}</span>
                </div>
                <span className="font-bold text-blue-900">
                  {stats?.option1Percentage || 0}%
                </span>
              </div>
              {stats && stats.totalVotes > 0 && (
                <Progress value={stats.option1Percentage} className="h-2" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="font-medium text-purple-900">{election.option2}</span>
                </div>
                <span className="font-bold text-purple-900">
                  {stats?.option2Percentage || 0}%
                </span>
              </div>
              {stats && stats.totalVotes > 0 && (
                <Progress value={stats.option2Percentage} className="h-2" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {isClosedManually
                  ? `Closed early ${formatDistanceToNow(new Date(election.closed_manually_at!), { addSuffix: true })}`
                  : isExpired
                  ? `Ended ${formatDistanceToNow(new Date(election.end_date), { addSuffix: true })}`
                  : `Ends ${formatDistanceToNow(new Date(election.end_date), { addSuffix: true })}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tally Processing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Tally Processing
          </CardTitle>
          <CardDescription>
            Process the final tally for "{election.title}" by decrypting nullification counts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tallyResults && (
            <>
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Enter the election authority's private key to decrypt and process nullification data. 
                  The private key will only be used locally in your browser and will not be stored.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="privateKey">Authority Private Key</Label>
                <Input
                  id="privateKey"
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Enter the election authority private key..."
                  disabled={isProcessing}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleProcessTally}
                disabled={isProcessing || !privateKey.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Calculator className="mr-2 h-4 w-4 animate-spin" />
                    Processing Tally...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Process Election Tally
                  </>
                )}
              </Button>
            </>
          )}
          
          {tallyResults && tallyStats && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Tally processing completed successfully on {new Date(tallyResults.processedAt).toLocaleString()}
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-3 gap-4">
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
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{tallyStats.totalNullifications}</div>
                        <div className="text-sm text-muted-foreground">Total Nullifications</div>
                      </div>
                    </CardContent>
                  </Card>
              </div>
              
              <Button 
                onClick={() => {
                  setTallyResults(null);
                  setError(null);
                }}
                variant="outline"
                className="w-full"
              >
                Process Another Tally
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Election Audit Log</DialogTitle>
          </DialogHeader>
          <ElectionAuditLog auditLog={auditLog} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ElectionAuthorityInterface;
