
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ElectionAuthorityInterface from '@/components/ElectionAuthorityInterface';
import TallyResultsDisplay from '@/components/TallyResultsDisplay';
import { ArrowLeft, Calendar, Users, Shield } from 'lucide-react';
import { isPast } from 'date-fns';

const ElectionAuthority = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTallyInterface, setShowTallyInterface] = useState(false);

  useEffect(() => {
    const fetchElection = async () => {
      if (!id) {
        setError('No election ID provided');
        setLoading(false);
        return;
      }

      try {
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
          .eq('id', id)
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

    fetchElection();
  }, [id]);

  const handleTallyComplete = () => {
    setShowTallyInterface(false);
    // Results will be automatically refreshed by the TallyResultsDisplay component
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center">
          <div className="text-lg">Loading election details...</div>
        </div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error || 'Election not found'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/elections')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Elections
        </Button>
      </div>
    );
  }

  const isElectionEnded = isPast(new Date(election.end_date));

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button onClick={() => navigate('/elections')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Elections
        </Button>
        <Badge variant={isElectionEnded ? "destructive" : "default"}>
          {isElectionEnded ? "Ended" : "Active"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Election Authority Dashboard
          </CardTitle>
          <CardDescription>
            Manage and process final results for this election
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Election Info
              </div>
              <div>
                <div className="font-semibold">{election.title}</div>
                <div className="text-sm text-muted-foreground">{election.description}</div>
              </div>
            </div>
            
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
                <Shield className="h-4 w-4" />
                Authority
              </div>
              <div>
                <div className="text-sm font-medium">
                  {election.election_authorities?.name || 'Default Election Authority'}
                </div>
                <div className="text-xs text-muted-foreground">
                  End Date: {new Date(election.end_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {isElectionEnded && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowTallyInterface(true)}
                variant={showTallyInterface ? "outline" : "default"}
                className="flex-1"
              >
                <Shield className="mr-2 h-4 w-4" />
                {showTallyInterface ? "Hide" : "Process"} Tally Interface
              </Button>
            </div>
          )}

          {!isElectionEnded && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                This election is still active. Tally processing will be available after the election ends on {new Date(election.end_date).toLocaleDateString()}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {showTallyInterface && isElectionEnded && (
        <ElectionAuthorityInterface
          electionId={election.id}
          electionTitle={election.title}
          onTallyComplete={handleTallyComplete}
        />
      )}

      <TallyResultsDisplay
        electionId={election.id}
        electionTitle={election.title}
        option1Name={election.option1}
        option2Name={election.option2}
      />
    </div>
  );
};

export default ElectionAuthority;
