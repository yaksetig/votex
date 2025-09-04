
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Users, Clock, Edit3, AlertTriangle, CheckCircle, FileCheck, FileX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getElectionsForAuthority } from '@/services/electionDataService';
import type { AuthorityElection } from '@/services/electionDataService';

interface AuthorityElectionsListProps {
  authorityId: string;
  authorityName: string;
  onElectionSelect: (electionId: string) => void;
}

const AuthorityElectionsList: React.FC<AuthorityElectionsListProps> = ({
  authorityId,
  authorityName,
  onElectionSelect
}) => {
  const [elections, setElections] = useState<AuthorityElection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchElections();
  }, [authorityId]);

  const fetchElections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching elections for authority:', authorityId);
      
      const electionsData = await getElectionsForAuthority(authorityId);
      setElections(electionsData);
      
      console.log(`Found ${electionsData.length} elections`);
    } catch (err) {
      console.error('Error fetching elections:', err);
      setError(err instanceof Error ? err.message : 'Failed to load elections');
      toast({
        variant: "destructive",
        title: "Error loading elections",
        description: "Failed to load elections for this authority",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (election: AuthorityElection) => {
    switch (election.status) {
      case 'closed_manually':
        return <Badge variant="destructive">Manually Closed</Badge>;
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'expired':
        return <Badge variant="destructive">Closed</Badge>;
      default:
        return <Badge variant="outline">{election.status}</Badge>;
    }
  };

  const getTallyBadge = (election: AuthorityElection) => {
    if (election.tally_processed) {
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

  const getStatusIcon = (election: AuthorityElection) => {
    switch (election.status) {
      case 'closed_manually':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'active':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="text-lg">Loading elections...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Elections Management</h1>
          <p className="text-muted-foreground mt-2">
            Managing elections for: <span className="font-medium">{authorityName}</span>
          </p>
        </div>
      </div>

      {elections.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Elections Found</h3>
            <p className="text-muted-foreground">
              This election authority has no elections yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {elections.map((election) => (
            <Card key={election.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(election)}
                      {election.title}
                    </CardTitle>
                    <CardDescription>{election.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(election)}
                    {getTallyBadge(election)}
                    <Button
                      onClick={() => onElectionSelect(election.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Voting Options
                    </div>
                    <div className="text-sm">
                      <div>• {election.option1}</div>
                      <div>• {election.option2}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Created
                    </div>
                    <div className="text-sm">
                      {new Date(election.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Timeline
                    </div>
                    <div className="text-sm">
                      <div>End Date: {new Date(election.end_date).toLocaleDateString()}</div>
                      {election.closed_manually_at && (
                        <div className="text-xs text-destructive mt-1">
                          Closed early: {new Date(election.closed_manually_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Votes Cast
                    </div>
                    <div className="text-sm font-medium">
                      {election.vote_count || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuthorityElectionsList;
