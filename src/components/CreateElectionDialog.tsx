
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useElections } from "@/contexts/ElectionContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/ui/use-toast";

const CreateElectionDialog = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [option1, setOption1] = useState("Yes");
  const [option2, setOption2] = useState("No");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createElection } = useElections();
  const { isWorldIDVerified, userId } = useWallet();
  const { toast } = useToast();

  const OPTION_MAX_LENGTH = 20; // Maximum characters for options

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !endDate || !userId || !option1 || !option2) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createElection(title, description, endDate, option1, option2);
      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error in createElection:", error);
      toast({
        title: "Creation failed",
        description: "Failed to create election. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOption1("Yes");
    setOption2("No");
    setEndDate(undefined);
  };

  // Get tomorrow's date for the minimum selectable date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isSubmitting) setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-crypto">Create Election</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Election</DialogTitle>
            <DialogDescription>
              Create a new election with custom voting options.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter election title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this election is about"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="option1">Option 1</Label>
                <Input
                  id="option1"
                  placeholder="First option (e.g., Yes)"
                  value={option1}
                  onChange={(e) => setOption1(e.target.value.slice(0, OPTION_MAX_LENGTH))}
                  required
                  maxLength={OPTION_MAX_LENGTH}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {option1.length}/{OPTION_MAX_LENGTH}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="option2">Option 2</Label>
                <Input
                  id="option2"
                  placeholder="Second option (e.g., No)"
                  value={option2}
                  onChange={(e) => setOption2(e.target.value.slice(0, OPTION_MAX_LENGTH))}
                  required
                  maxLength={OPTION_MAX_LENGTH}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {option2.length}/{OPTION_MAX_LENGTH}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => date < tomorrow}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              className="bg-gradient-crypto"
              disabled={isSubmitting || !title || !description || !endDate || !option1 || !option2}
            >
              {isSubmitting ? "Creating..." : "Create Election"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateElectionDialog;
