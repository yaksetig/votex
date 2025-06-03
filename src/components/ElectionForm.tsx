
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredKeypair } from "@/services/keypairService";
import { 
  getElectionAuthorities, 
  createElectionAuthority, 
  ElectionAuthority 
} from "@/services/electionAuthorityService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  option1: z.string().min(1, "Option 1 is required"),
  option2: z.string().min(1, "Option 2 is required"),
  endDate: z.date().refine((date) => date > new Date(), {
    message: "End date must be in the future",
  }),
  authorityId: z.string().optional(),
  newAuthorityName: z.string().optional(),
  newAuthorityDescription: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ElectionFormProps {
  onSubmit: (data: FormData & { authorityId?: string }) => void;
  onCancel: () => void;
}

const ElectionForm: React.FC<ElectionFormProps> = ({ onSubmit, onCancel }) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [authorities, setAuthorities] = useState<ElectionAuthority[]>([]);
  const [createNewAuthority, setCreateNewAuthority] = useState(false);
  const [loadingAuthorities, setLoadingAuthorities] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      option1: "Yes",
      option2: "No",
    },
  });

  const selectedAuthorityId = watch("authorityId");

  useEffect(() => {
    fetchAuthorities();
  }, []);

  const fetchAuthorities = async () => {
    try {
      setLoadingAuthorities(true);
      const authoritiesList = await getElectionAuthorities();
      setAuthorities(authoritiesList);
    } catch (error) {
      console.error("Error fetching authorities:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load election authorities."
      });
    } finally {
      setLoadingAuthorities(false);
    }
  };

  const onSubmitForm = async (data: FormData) => {
    try {
      let finalAuthorityId = data.authorityId;

      // If creating new authority, create it first
      if (createNewAuthority && data.newAuthorityName) {
        const keypair = getStoredKeypair();
        if (!keypair) {
          toast({
            variant: "destructive",
            title: "Keypair Required",
            description: "Please generate a cryptographic keypair first."
          });
          return;
        }

        const newAuthority = await createElectionAuthority(
          data.newAuthorityName,
          data.newAuthorityDescription || "",
          keypair
        );

        if (!newAuthority) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to create election authority."
          });
          return;
        }

        finalAuthorityId = newAuthority.id;
      }

      onSubmit({ ...data, authorityId: finalAuthorityId });
      
      toast({
        title: "Election created",
        description: "Your election has been created successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to create election",
        description: "There was an error creating your election. Please try again.",
      });
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      setValue("endDate", selectedDate, { shouldValidate: true });
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Election Title</Label>
            <Input
              id="title"
              placeholder="Enter the election title"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this election is about"
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="option1">Option 1</Label>
              <Input
                id="option1"
                placeholder="First option (default: Yes)"
                {...register("option1")}
              />
              {errors.option1 && (
                <p className="text-sm text-red-500">{errors.option1.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2">Option 2</Label>
              <Input
                id="option2"
                placeholder="Second option (default: No)"
                {...register("option2")}
              />
              {errors.option2 && (
                <p className="text-sm text-red-500">{errors.option2.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="endDate"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Select end date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.endDate && (
              <p className="text-sm text-red-500">{errors.endDate.message}</p>
            )}
          </div>

          {/* Election Authority Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Election Authority</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateNewAuthority(!createNewAuthority)}
              >
                {createNewAuthority ? "Select Existing" : "Create New"}
              </Button>
            </div>

            {!createNewAuthority ? (
              <div className="space-y-2">
                <Select onValueChange={(value) => setValue("authorityId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingAuthorities ? "Loading authorities..." : "Select an election authority"} />
                  </SelectTrigger>
                  <SelectContent>
                    {authorities.map((authority) => (
                      <SelectItem key={authority.id} value={authority.id}>
                        {authority.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {authorities.length === 0 && !loadingAuthorities && (
                  <p className="text-sm text-muted-foreground">
                    No election authorities found. Create a new one to proceed.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="newAuthorityName">Authority Name</Label>
                  <Input
                    id="newAuthorityName"
                    placeholder="Enter authority name"
                    {...register("newAuthorityName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newAuthorityDescription">Authority Description (Optional)</Label>
                  <Textarea
                    id="newAuthorityDescription"
                    placeholder="Describe the election authority"
                    rows={2}
                    {...register("newAuthorityDescription")}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Election"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ElectionForm;
