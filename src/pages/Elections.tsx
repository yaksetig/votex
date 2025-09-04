import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { initializeDefaultElectionAuthority } from "@/services/electionAuthorityService";
import ElectionForm from "@/components/ElectionForm";
import ElectionsList from "@/components/ElectionsList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Vote, TrendingUp, Users, Clock } from "lucide-react";
import { isPast } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const Elections = () => {
  const { userId } = useWallet();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching elections...');
      
      // Simplified query without joins to avoid relationship conflicts
      const { data: electionsData, error: electionsError } = await supabase
        .from("elections")
        .select("*")
        .order("created_at", { ascending: false });

      if (electionsError) {
        console.error("Supabase error:", electionsError);
        toast({
          variant: "destructive",
          title: "Error loading elections",
          description: electionsError.message
        });
        throw electionsError;
      }

      console.log('Elections fetched:', electionsData);
      
      // If we have elections and need authority data, fetch it separately
      let enrichedElections = electionsData || [];
      
      if (electionsData && electionsData.length > 0) {
        // Get unique authority IDs
        const authorityIds = [...new Set(electionsData.map(e => e.authority_id).filter(Boolean))];
        
        if (authorityIds.length > 0) {
          const { data: authoritiesData, error: authoritiesError } = await supabase
            .from("election_authorities")
            .select("*")
            .in("id", authorityIds);
            
          if (!authoritiesError && authoritiesData) {
            // Map authorities to elections
            enrichedElections = electionsData.map(election => ({
              ...election,
              election_authorities: authoritiesData.find(auth => auth.id === election.authority_id) || null
            }));
          }
        }
      }
      
      setElections(enrichedElections);
    } catch (error) {
      console.error("Error fetching elections:", error);
      toast({
        variant: "destructive",
        title: "Failed to load elections",
        description: "Please try refreshing the page"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        console.log('Initializing election authority and fetching elections...');
        await initializeDefaultElectionAuthority();
        await fetchElections();
      } catch (error) {
        console.error('Error during initialization:', error);
      }
    };
    
    initializeAndFetch();
  }, [fetchElections]);

  const handleFormSubmit = async (formData: any) => {
    try {
      console.log('Creating new election with data:', formData);
      
      const { data, error } = await supabase
        .from("elections")
        .insert({
          title: formData.title,
          description: formData.description,
          option1: formData.option1,
          option2: formData.option2,
          creator: userId,
          end_date: formData.endDate.toISOString(),
          authority_id: formData.authorityId,
        })
        .select();

      if (error) {
        console.error("Error creating election:", error);
        toast({
          variant: "destructive",
          title: "Failed to create election",
          description: error.message
        });
        throw error;
      }
      
      console.log('Election created successfully:', data);
      
      // Refresh the elections list to show the new election
      await fetchElections();
      setShowForm(false);
      
      toast({
        title: "Election created successfully",
        description: `"${formData.title}" has been created and is now active.`
      });
    } catch (error) {
      console.error("Error creating election:", error);
    }
  };

  // Separate elections into ongoing and expired using comprehensive status check
  const ongoingElections = elections.filter(election => {
    const endDate = new Date(election.end_date);
    const isNaturallyExpired = isPast(endDate);
    const isManuallyClosed = election.closed_manually_at != null;
    const hasClosedStatus = election.status === 'closed_manually';
    
    // Election is active if it's not naturally expired AND not manually closed
    return !isNaturallyExpired && !isManuallyClosed && !hasClosedStatus;
  });
  
  const expiredElections = elections.filter(election => {
    const endDate = new Date(election.end_date);
    const isNaturallyExpired = isPast(endDate);
    const isManuallyClosed = election.closed_manually_at != null;
    const hasClosedStatus = election.status === 'closed_manually';
    
    // Election is expired/completed if it's naturally expired OR manually closed
    return isNaturallyExpired || isManuallyClosed || hasClosedStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800/50 to-slate-700/50"></div>
        <div className="relative container mx-auto py-16 px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-3 bg-slate-800/80 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-600 mb-8">
              <Vote className="h-6 w-6 text-purple-400" />
              <span className="text-white font-semibold">Democratic Voting Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent mb-6">
              Shape the Future
            </h1>
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Participate in secure, transparent elections that matter. Your voice, your vote, your impact.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={() => setShowForm(!showForm)} 
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="mr-3 h-5 w-5" />
                {showForm ? "Cancel Creation" : "Create New Election"}
              </Button>
              
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <span>{ongoingElections.length} Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{expiredElections.length} Completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="container mx-auto px-6 mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6">
                <h2 className="text-2xl font-bold text-white">Create New Election</h2>
                <p className="text-purple-100 mt-1">Set up a new democratic process</p>
              </div>
              <div className="p-8">
                <ElectionForm onSubmit={handleFormSubmit} onCancel={() => setShowForm(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Elections Section */}
      <div className="container mx-auto px-6 pb-16">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="ongoing" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-2xl p-2 shadow-lg">
                <TabsTrigger 
                  value="ongoing" 
                  className="px-8 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 text-slate-300 data-[state=inactive]:hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                    <span className="font-semibold">Active Elections</span>
                    <span className="bg-current/20 px-2 py-1 rounded-full text-xs font-bold">
                      {ongoingElections.length}
                    </span>
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="expired"
                  className="px-8 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 text-slate-300 data-[state=inactive]:hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-current rounded-full"></div>
                    <span className="font-semibold">Completed Elections</span>
                    <span className="bg-current/20 px-2 py-1 rounded-full text-xs font-bold">
                      {expiredElections.length}
                    </span>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="ongoing" className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-3">Live Elections</h2>
                <p className="text-slate-300 text-lg">Cast your vote and make your voice heard</p>
              </div>
              <ElectionsList elections={ongoingElections} loading={loading} />
            </TabsContent>
            
            <TabsContent value="expired" className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-3">Election Archive</h2>
                <p className="text-slate-300 text-lg">Review past elections and their results</p>
              </div>
              <ElectionsList elections={expiredElections} loading={loading} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Elections;
