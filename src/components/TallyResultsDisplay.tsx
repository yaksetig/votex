
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { getElectionTallyResults, TallyResult } from '@/services/tallyService';
import { getNullificationsForElection } from '@/services/nullificationService';
import { getElectionVoteData, VoteData } from '@/services/voteTrackingService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Vote, Shield, Users, TrendingUp, RefreshCw } from 'lucide-react';

interface TallyResultsDisplayProps {
  electionId: string;
  electionTitle: string;
  option1Name: string;
  option2Name: string;
}

const TallyResultsDisplay: React.FC<TallyResultsDisplayProps> = ({
  electionId,
  electionTitle,
  option1Name,
  option2Name
}) => {
  const [tallyResults, setTallyResults] = useState<TallyResult[]>([]);
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [totalNullifications, setTotalNullifications] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchTallyData = async () => {
    try {
      setLoading(true);
      
      console.log('TallyResultsDisplay: Fetching tally data for election:', electionId);
      
      const [tallyData, voteTrackingData, nullificationData] = await Promise.all([
        getElectionTallyResults(electionId),
        getElectionVoteData(electionId),
        getNullificationsForElection(electionId)
      ]);
      
      console.log('TallyResultsDisplay: Raw data fetched:', {
        tallyResults: tallyData,
        voteData: voteTrackingData,
        totalNullifications: nullificationData.length
      });
      
      setTallyResults(tallyData);
      setVoteData(voteTrackingData);
      setTotalNullifications(nullificationData.length);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('TallyResultsDisplay: Error fetching tally data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTallyData();
  }, [electionId]);

  const getChartData = () => {
    if (!voteData) {
      console.log('TallyResultsDisplay: No vote data for chart');
      return [];
    }
    
    console.log('TallyResultsDisplay: Creating chart data from vote data:', voteData);
    
    const chartData = [
      {
        name: 'Preliminary Results',
        [option1Name]: voteData.totalYesVotes,
        [option2Name]: voteData.totalNoVotes,
      },
      {
        name: 'Final Results',
        [option1Name]: voteData.validYesVotes,
        [option2Name]: voteData.validNoVotes,
      }
    ];
    
    console.log('TallyResultsDisplay: Generated chart data:', chartData);
    
    return chartData;
  };

  const hasTallyData = tallyResults.length > 0;
  const chartData = getChartData();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading tally results...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Election Results</h2>
          <p className="text-muted-foreground">{electionTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={hasTallyData ? "default" : "secondary"}>
            {hasTallyData ? "Tally Processed" : "Vote Tracking Active"}
          </Badge>
          <Button onClick={fetchTallyData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
      
      {voteData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <Vote className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">
                  {voteData.totalYesVotes + voteData.totalNoVotes}
                </div>
                <div className="text-sm text-muted-foreground">Total Votes</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <Shield className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">
                  {voteData.validYesVotes + voteData.validNoVotes}
                </div>
                <div className="text-sm text-muted-foreground">Valid Votes</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">
                  {voteData.nullifiedYesVotes + voteData.nullifiedNoVotes}
                </div>
                <div className="text-sm text-muted-foreground">Nullified Votes</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">
                  {totalNullifications}
                </div>
                <div className="text-sm text-muted-foreground">Total Nullifications</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chart">Results Chart</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vote Comparison</CardTitle>
              <CardDescription>
                Comparing preliminary results vs final results after nullification processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {voteData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label) => `Results: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey={option1Name} fill="#3b82f6" name={option1Name} />
                    <Bar dataKey={option2Name} fill="#ef4444" name={option2Name} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {!voteData ? "No vote data available yet" : "No votes to display"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="detailed" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Preliminary Results</CardTitle>
                <CardDescription>All votes before nullification processing</CardDescription>
              </CardHeader>
              <CardContent>
                {voteData ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{option1Name}:</span>
                      <span className="font-bold">{voteData.totalYesVotes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{option2Name}:</span>
                      <span className="font-bold">{voteData.totalNoVotes}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Final Results</CardTitle>
                <CardDescription>Results after nullification processing</CardDescription>
              </CardHeader>
              <CardContent>
                {voteData ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{option1Name}:</span>
                      <span className="font-bold">{voteData.validYesVotes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{option2Name}:</span>
                      <span className="font-bold">{voteData.validNoVotes}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Nullified: {voteData.nullifiedYesVotes} {option1Name}, {voteData.nullifiedNoVotes} {option2Name}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No tally processed yet</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {lastUpdated.toLocaleString()}
      </div>
    </div>
  );
};

export default TallyResultsDisplay;
