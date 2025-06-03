
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { getStoredKeypair } from "@/services/keypairService";
import { 
  getElectionAuthorities, 
  createElectionAuthority, 
  ElectionAuthority 
} from "@/services/electionAuthorityService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

import ElectionBasicDetails from "@/components/ElectionForm/ElectionBasicDetails";
import ElectionDatePicker from "@/components/ElectionForm/ElectionDatePicker";
import ElectionAuthoritySelector from "@/components/ElectionForm/ElectionAuthoritySelector";
import { formSchema, FormData, ElectionFormProps } from "@/components/ElectionForm/types";

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

          <ElectionAuthoritySelector
            authorities={authorities}
            loadingAuthorities={loadingAuthorities}
            createNewAuthority={createNewAuthority}
            setCreateNewAuthority={setCreateNewAuthority}
            register={register}
            setValue={setValue}
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
