
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Users, Clock, Edit3, AlertTriangle, CheckCircle, FileCheck, FileX, BarChart3, TrendingUp, Eye } from 'lucide-react';
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
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">Manually Closed</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-300">Closed</Badge>;
      default:
        return <Badge variant="outline">{election.status}</Badge>;
    }
  };

  const getTallyBadge = (election: AuthorityElection) => {
    if (election.tally_processed) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
          <FileCheck className="mr-1 h-3 w-3" />
          Tallied
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
          <FileX className="mr-1 h-3 w-3" />
          Pending Tally
        </Badge>
      );
    }
  };

  const getStatusIcon = (election: AuthorityElection) => {
    switch (election.status) {
      case 'closed_manually':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto py-8 px-4">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg animate-pulse">
                <CardHeader className="pb-4">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const activeElections = elections.filter(e => e.status === 'active');
  const completedElections = elections.filter(e => e.status !== 'active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="container mx-auto py-12 px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Election Authority Dashboard</h1>
            <p className="text-xl text-blue-100 mb-2">
              Managing elections for: <span className="font-semibold text-white">{authorityName}</span>
            </p>
            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="text-center">
                <div className="text-3xl font-bold">{elections.length}</div>
                <div className="text-blue-200 text-sm">Total Elections</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-300">{activeElections.length}</div>
                <div className="text-blue-200 text-sm">Active</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-300">{completedElections.length}</div>
                <div className="text-blue-200 text-sm">Completed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8 px-4">
        {elections.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <Card className="border-0 shadow-xl bg-white rounded-3xl overflow-hidden">
              <CardContent className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">No Elections Found</h3>
                <p className="text-gray-600 text-lg">
                  This election authority has no elections yet. Elections will appear here once they are created.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Elections */}
            {activeElections.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Active Elections</h2>
                  <Badge className="bg-green-100 text-green-800 border-green-300">{activeElections.length}</Badge>
                </div>
                <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {activeElections.map((election) => (
                    <Card key={election.id} className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-500 rounded-2xl overflow-hidden bg-gradient-to-br from-white to-green-50 hover:from-green-50 hover:to-emerald-50">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                            {getStatusIcon(election)}
                            {election.title}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-gray-600 line-clamp-2">{election.description}</CardDescription>
                        <div className="flex items-center gap-2 pt-2">
                          {getStatusBadge(election)}
                          {getTallyBadge(election)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                              <Users className="h-3 w-3" />
                              Options
                            </div>
                            <div className="text-sm font-medium">
                              <div className="truncate">• {election.option1}</div>
                              <div className="truncate">• {election.option2}</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                              <BarChart3 className="h-3 w-3" />
                              Votes Cast
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                              {election.vote_count || 0}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                            <Calendar className="h-3 w-3" />
                            Timeline
                          </div>
                          <div className="text-sm">
                            <div>Created: {new Date(election.created_at).toLocaleDateString()}</div>
                            <div>Ends: {new Date(election.end_date).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => onElectionSelect(election.id)}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                            size="sm"
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Manage
                          </Button>
                          <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Elections */}
            {completedElections.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-slate-600 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Completed Elections</h2>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-300">{completedElections.length}</Badge>
                </div>
                <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {completedElections.map((election) => (
                    <Card key={election.id} className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-slate-50">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                            {getStatusIcon(election)}
                            {election.title}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-gray-600 line-clamp-2">{election.description}</CardDescription>
                        <div className="flex items-center gap-2 pt-2">
                          {getStatusBadge(election)}
                          {getTallyBadge(election)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                              <Users className="h-3 w-3" />
                              Options
                            </div>
                            <div className="text-sm font-medium">
                              <div className="truncate">• {election.option1}</div>
                              <div className="truncate">• {election.option2}</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                              <BarChart3 className="h-3 w-3" />
                              Votes Cast
                            </div>
                            <div className="text-2xl font-bold text-gray-600">
                              {election.vote_count || 0}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                            <Calendar className="h-3 w-3" />
                            Timeline
                          </div>
                          <div className="text-sm">
                            <div>Created: {new Date(election.created_at).toLocaleDateString()}</div>
                            <div>Ended: {new Date(election.end_date).toLocaleDateString()}</div>
                            {election.closed_manually_at && (
                              <div className="text-xs text-red-600 mt-1">
                                Closed early: {new Date(election.closed_manually_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => onElectionSelect(election.id)}
                            variant="outline"
                            className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                            size="sm"
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            View Results
                          </Button>
                          <Button variant="outline" size="sm" className="border-gray-200 text-gray-700 hover:bg-gray-50">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorityElectionsList;
