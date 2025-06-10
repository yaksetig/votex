
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Calendar, Clock, Search, Users, Vote } from 'lucide-react';
import { getElectionsForAuthority, AuthorityElection } from '@/services/electionManagementService';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'closed' | 'expired'>('all');

  useEffect(() => {
    fetchElections();
  }, [authorityId]);

  const fetchElections = async () => {
    try {
      setLoading(true);
      const fetchedElections = await getElectionsForAuthority(authorityId);
      setElections(fetchedElections);
    } catch (error) {
      console.error('Error fetching elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'closed_manually':
        return <Badge variant="destructive">Manually Closed</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredElections = elections.filter(election => {
    const matchesSearch = election.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         election.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || election.status === filter || 
                         (filter === 'closed' && election.status === 'closed_manually');
    return matchesSearch && matchesFilter;
  });

  const getElectionStats = () => {
    const total = elections.length;
    const active = elections.filter(e => e.status === 'active').length;
    const closed = elections.filter(e => e.status === 'closed_manually').length;
    const expired = elections.filter(e => e.status === 'expired').length;
    const totalVotes = elections.reduce((sum, e) => sum + (e.vote_count || 0), 0);
    
    return { total, active, closed, expired, totalVotes };
  };

  const stats = getElectionStats();

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center">
          <div className="text-lg">Loading elections...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Election Authority Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {authorityName}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Elections</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-red-600">{stats.closed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Votes</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalVotes}</p>
              </div>
              <Vote className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search elections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All
          </Button>
          <Button 
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
            size="sm"
          >
            Active
          </Button>
          <Button 
            variant={filter === 'closed' ? 'default' : 'outline'}
            onClick={() => setFilter('closed')}
            size="sm"
          >
            Closed
          </Button>
          <Button 
            variant={filter === 'expired' ? 'default' : 'outline'}
            onClick={() => setFilter('expired')}
            size="sm"
          >
            Expired
          </Button>
        </div>
      </div>

      {/* Elections List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredElections.map((election) => (
          <Card key={election.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{election.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {election.description}
                  </CardDescription>
                </div>
                {getStatusBadge(election.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Options:</span>
                  <span className="font-medium">{election.option1} vs {election.option2}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Votes:</span>
                  <span className="font-medium">{election.vote_count || 0}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {new Date(election.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Date:</span>
                  <span className="font-medium">
                    {new Date(election.end_date).toLocaleDateString()}
                  </span>
                </div>

                {election.closed_manually_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Closed:</span>
                    <span className="font-medium text-red-600">
                      {new Date(election.closed_manually_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <Button 
                  onClick={() => onElectionSelect(election.id)}
                  className="w-full mt-4"
                  variant="outline"
                >
                  Manage Election
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredElections.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              {searchTerm || filter !== 'all' 
                ? 'No elections match your search criteria.'
                : 'No elections found for this authority.'
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AuthorityElectionsList;
