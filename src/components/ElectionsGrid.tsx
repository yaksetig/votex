
import React from "react";
import { useElections } from "@/contexts/ElectionContext";
import ElectionCard from "@/components/ElectionCard";

const ElectionsGrid = () => {
  const { elections } = useElections();

  if (elections.length === 0) {
    return (
      <div className="text-center p-12">
        <h3 className="text-xl">No elections found</h3>
        <p className="text-muted-foreground mt-2">Create the first election to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {elections.map((election) => (
        <ElectionCard key={election.id} election={election} />
      ))}
    </div>
  );
};

export default ElectionsGrid;
