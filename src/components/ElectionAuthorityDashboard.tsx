import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, BarChart3, Calendar, XCircle } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

interface ElectionAuthorityDashboardProps {
  electionId: string;
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

interface ElectionStats {
  totalVotes: number;
  option1Votes: number;
  option2Votes: number;
  option1Percentage: number;
  option2Percentage: number;
}

const ElectionAuthorityDashboard: React.FC<ElectionAuthorityDashboardProps> = ({ electionId }) => {
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<ElectionStats | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (error) {
      console.error('Error fetching election:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch election data',
      });
      setElection(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Election data unavailable</div>
      </div>
    );
  }

  const isExpired = isPast(new Date(election.end_date));

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <Card className="border-slate-700 bg-slate-800 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="p-6 pb-4 flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-white mb-2">
              {election.title}
            </CardTitle>
            <div className="flex items-center gap-2 mb-3">
              {isExpired ? (
                <Badge variant="secondary" className="bg-slate-600 text-slate-100 border-slate-500">
                  <XCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-green-600 text-green-100 border-green-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1"></div>
                  Active
                </Badge>
              )}
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {stats?.totalVotes || 0} votes
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-700 text-blue-400">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-700 text-slate-300">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-700 text-green-400">
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <p className="text-sm text-slate-400 mb-4">{election.description}</p>
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 bg-blue-900/50 rounded-xl border border-blue-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-sm font-medium text-blue-200">{election.option1}</span>
              </div>
              <span className="text-sm font-bold text-blue-300">
                {stats?.option1Percentage || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-900/50 rounded-xl border border-purple-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="text-sm font-medium text-purple-200">{election.option2}</span>
              </div>
              <span className="text-sm font-bold text-purple-300">
                {stats?.option2Percentage || 0}%
              </span>
            </div>
          </div>
          {stats && stats.totalVotes > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Progress value={stats.option1Percentage} className="h-2 bg-slate-700" />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${stats.option1Percentage}%` }}
                ></div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
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
    </div>
  );
};

export default ElectionAuthorityDashboard;
