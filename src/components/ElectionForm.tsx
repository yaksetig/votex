
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { 
  initializeDefaultElectionAuthority
} from "@/services/electionAuthorityService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

import ElectionBasicDetails from "@/components/ElectionForm/ElectionBasicDetails";
import ElectionDatePicker from "@/components/ElectionForm/ElectionDatePicker";
import { formSchema, FormData, ElectionFormProps } from "@/components/ElectionForm/types";

const ElectionForm: React.FC<ElectionFormProps> = ({ onSubmit, onCancel }) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [defaultAuthorityId, setDefaultAuthorityId] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      option1: "Yes",
      option2: "No",
    },
  });

  useEffect(() => {
    initializeDefaultAuthority();
  }, []);

  const initializeDefaultAuthority = async () => {
    try {
      // Ensure default authority exists and get its ID
      const defaultAuthority = await initializeDefaultElectionAuthority();
      
      if (defaultAuthority) {
        setDefaultAuthorityId(defaultAuthority.id);
        setValue("authorityId", defaultAuthority.id);
      }
    } catch (error) {
      console.error("Error initializing default authority:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initialize default election authority."
      });
    }
  };

  const onSubmitForm = async (data: FormData) => {
    try {
      // Always use the default authority
      const finalData = {
        ...data,
        authorityId: defaultAuthorityId
      };

      onSubmit(finalData);
      
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

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <CardContent className="space-y-4 pt-6">
          <ElectionBasicDetails register={register} errors={errors} />
          
          <ElectionDatePicker 
            date={date} 
            setDate={setDate} 
            setValue={setValue} 
            errors={errors} 
          />
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
