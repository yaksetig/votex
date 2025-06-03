
import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import ElectionForm from "@/components/ElectionForm";
import ElectionsList from "@/components/ElectionsList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { isPast } from "date-fns";

const Elections = () => {
  const { userId } = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchElections = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("elections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setElections(data || []);
    } catch (error) {
      console.error("Error fetching elections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const handleFormSubmit = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from("elections")
        .insert({
          title: formData.title,
          description: formData.description,
          option1: formData.option1,
          option2: formData.option2,
          creator: userId,
          end_date: formData.endDate.toISOString(),
        })
        .select();

      if (error) throw error;
      
      setElections([data[0], ...elections]);
      setShowForm(false);
    } catch (error) {
      console.error("Error creating election:", error);
    }
  };

  // Separate elections into ongoing and expired
  const ongoingElections = elections.filter(election => !isPast(new Date(election.end_date)));
  const expiredElections = elections.filter(election => isPast(new Date(election.end_date)));

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Elections</h1>
        <Button onClick={() => setShowForm(!showForm)} className="shadow-lg">
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancel" : "Create Election"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <ElectionForm onSubmit={handleFormSubmit} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <Tabs defaultValue="ongoing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="ongoing" className="text-sm font-medium">
            Ongoing Elections ({ongoingElections.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="text-sm font-medium">
            Expired Elections ({expiredElections.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ongoing" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-green-600">Active Elections</h2>
            <span className="text-sm text-muted-foreground">
              {ongoingElections.length} election{ongoingElections.length !== 1 ? 's' : ''} available
            </span>
          </div>
          <ElectionsList elections={ongoingElections} loading={loading} />
        </TabsContent>
        
        <TabsContent value="expired" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-red-600">Completed Elections</h2>
            <span className="text-sm text-muted-foreground">
              {expiredElections.length} election{expiredElections.length !== 1 ? 's' : ''} completed
            </span>
          </div>
          <ElectionsList elections={expiredElections} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Elections;
