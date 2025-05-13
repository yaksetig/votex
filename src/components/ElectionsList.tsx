
import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isPast } from "date-fns";
import { EyeIcon, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Election {
  id: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  end_date: string;
  created_at: string;
}

interface ElectionsListProps {
  elections: Election[];
  loading: boolean;
}

const ElectionsList: React.FC<ElectionsListProps> = ({ elections, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-pulse h-6 w-24 bg-muted rounded mx-auto"></div>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <Card className="text-center py-10">
        <CardContent>
          <p className="text-muted-foreground">No elections found. Create one to get started!</p>
        </CardContent>
      </Card>
    );
  }

  const viewElection = (id: string) => {
    navigate(`/elections/${id}`);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {elections.map((election) => {
        const endDate = new Date(election.end_date);
        const isExpired = isPast(endDate);

        return (
          <Card key={election.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{election.title}</span>
                {isExpired ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                {isExpired 
                  ? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}` 
                  : `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {election.description}
              </p>
              <div className="mt-4 flex justify-between">
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {election.option1}
                </span>
                <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                  {election.option2}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => viewElection(election.id)}
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                View Election
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};

export default ElectionsList;
