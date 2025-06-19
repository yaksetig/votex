
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Users, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Calendar,
  Vote,
  Eye,
  Edit,
  Trash2,
  Plus,
  Activity,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

interface ElectionAuthorityDashboardProps {
  electionId?: string;
  onLogout: () => void;
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
}

interface VoteData {
  election_id: string;
  choice: string;
}

interface ElectionStats {
  totalVotes: number;
  option1Votes: number;
  option2Votes: number;
  option1Percentage: number;
  option2Percentage: number;
}

const ElectionAuthorityDashboard: React.FC<ElectionAuthorityDashboardProps> = ({ 
  electionId, 
  onLogout 
}) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [voteStats, setVoteStats] = useState<Record<string, ElectionStats>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      setLoading(true);
      
      // Fetch all elections
      const { data: electionsData, error: electionsError } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false });

      if (electionsError) throw electionsError;

      setElections(electionsData || []);

      // Fetch vote statistics for all elections
      if (electionsData && electionsData.length > 0) {
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('election_id, choice')
          .in('election_id', electionsData.map(e => e.id));

        if (votesError) throw votesError;

        // Calculate statistics
        const stats: Record<string, ElectionStats> = {};
        electionsData.forEach(election => {
          const electionVotes = votesData?.filter(vote => vote.election_id === election.id) || [];
          const option1Votes = electionVotes.filter(vote => vote.choice === election.option1).length;
          const option2Votes = electionVotes.filter(vote => vote.choice === election.option2).length;
          const totalVotes = option1Votes + option2Votes;
          
          stats[election.id] = {
            totalVotes,
            option1Votes,
            option2Votes,
            option1Percentage: totalVotes > 0 ? Math.round((option1Votes / totalVotes) * 100) : 0,
            option2Percentage: totalVotes > 0 ? Math.round((option2Votes / totalVotes) * 100) : 0,
          };
        });
        
        setVoteStats(stats);
      }
    } catch (error) {
      console.error('Error fetching elections:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch elections data'
      });
    } finally {
      setLoading(false);
    }
  };

  const activeElections = elections.filter(election => !isPast(new Date(election.end_date)));
  const completedElections = elections.filter(election => isPast(new Date(election.end_date)));
  const totalVotes = Object.values(voteStats).reduce((sum, stats) => sum + stats.totalVotes, 0);

  const StatCard = ({ title, value, icon: Icon, description, trend }: {
    title: string;
    value: string | number;
    icon: any;
    description: string;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <div className={`p-3 rounded-2xl ${
            trend === 'up' ? 'bg-green-100' : 
            trend === 'down' ? 'bg-red-100' : 
            'bg-blue-100'
          }`}>
            <Icon className={`h-8 w-8 ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 
              'text-blue-600'
            }`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ElectionCard = ({ election }: { election: Election }) => {
    const isExpired = isPast(new Date(election.end_date));
    const stats = voteStats[election.id];
    
    return (
      <Card className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-500 rounded-2xl overflow-hidden bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-indigo-50">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                {election.title}
              </CardTitle>
              <div className="flex items-center gap-2 mb-3">
                {isExpired ? (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                    Active
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {stats?.totalVotes || 0} votes
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100">
                <Eye className="h-4 w-4 text-blue-600" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                <Edit className="h-4 w-4 text-gray-600" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="px-6 pb-4">
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{election.description}</p>
          
          {/* Voting Options */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">{election.option1}</span>
              </div>
              <span className="text-sm font-bold text-blue-700">
                {stats?.option1Percentage || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium text-purple-900">{election.option2}</span>
              </div>
              <span className="text-sm font-bold text-purple-700">
                {stats?.option2Percentage || 0}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {stats && stats.totalVotes > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Progress value={stats.option1Percentage} className="h-2 bg-gray-200" />
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.option1Percentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {isExpired 
                  ? `Ended ${formatDistanceToNow(new Date(election.end_date), { addSuffix: true })}` 
                  : `Ends ${formatDistanceToNow(new Date(election.end_date), { addSuffix: true })}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto p-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Election Authority Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Monitor and manage all elections</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Shield className="h-3 w-3 mr-1" />
                Authority Access
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-8">
        {/* Statistics Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Elections"
            value={elections.length}
            icon={Vote}
            description="All time elections"
            trend="neutral"
          />
          <StatCard
            title="Active Elections"
            value={activeElections.length}
            icon={Activity}
            description="Currently running"
            trend="up"
          />
          <StatCard
            title="Total Votes Cast"
            value={totalVotes.toLocaleString()}
            icon={Users}
            description="Across all elections"
            trend="up"
          />
          <StatCard
            title="Completion Rate"
            value={`${elections.length > 0 ? Math.round((completedElections.length / elections.length) * 100) : 0}%`}
            icon={TrendingUp}
            description="Elections completed"
            trend="neutral"
          />
        </div>

        {/* Elections Management */}
        <Card className="border-0 shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold mb-2">Elections Management</CardTitle>
                <CardDescription className="text-blue-100">
                  Monitor, analyze, and manage all elections in the system
                </CardDescription>
              </div>
              <Button variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50">
                <Plus className="h-4 w-4 mr-2" />
                New Election
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <div className="border-b border-gray-100 px-8 pt-6">
                <TabsList className="bg-gray-50 border border-gray-200 rounded-xl p-1">
                  <TabsTrigger 
                    value="overview" 
                    className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 font-medium"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="active"
                    className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-600 font-medium"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Active ({activeElections.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="completed"
                    className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-600 font-medium"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Completed ({completedElections.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="p-8">
                <TabsContent value="overview" className="mt-0">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {elections.map((election) => (
                      <ElectionCard key={election.id} election={election} />
                    ))}
                  </div>
                  {elections.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Vote className="h-10 w-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Elections Found</h3>
                      <p className="text-gray-600">Start by creating your first election to manage democratic processes.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="active" className="mt-0">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeElections.map((election) => (
                      <ElectionCard key={election.id} election={election} />
                    ))}
                  </div>
                  {activeElections.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="h-10 w-10 text-green-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Elections</h3>
                      <p className="text-gray-600">All elections have been completed or none have been created yet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="completed" className="mt-0">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {completedElections.map((election) => (
                      <ElectionCard key={election.id} election={election} />
                    ))}
                  </div>
                  {completedElections.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="h-10 w-10 text-gray-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Completed Elections</h3>
                      <p className="text-gray-600">Elections that have ended will appear here.</p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ElectionAuthorityDashboard;
