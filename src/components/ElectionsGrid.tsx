
import React from "react";
import { useElections } from "@/contexts/ElectionContext";
import ElectionCard from "@/components/ElectionCard";
import { Skeleton } from "@/components/ui/skeleton";

const ElectionsGrid = () => {
  const { elections, loading } = useElections();

  // Show loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[300px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Show empty state
  if (elections.length === 0) {
    return (
      <div className="text-center p-12">
        <h3 className="text-xl">No elections found</h3>
        <p className="text-muted-foreground mt-2">Create the first election to get started!</p>
      </div>
    );
  }

  // Show elections
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {elections.map((election) => (
        <ElectionCard key={election.id} election={election} />
      ))}
    </div>
  );
};

export default ElectionsGrid;
