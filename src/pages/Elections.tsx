
import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import ElectionForm from "@/components/ElectionForm";
import ElectionsList from "@/components/ElectionsList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Elections</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancel" : "Create Election"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <ElectionForm onSubmit={handleFormSubmit} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <ElectionsList elections={elections} loading={loading} />
    </div>
  );
};

export default Elections;
