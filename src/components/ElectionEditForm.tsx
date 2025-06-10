
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Save, AlertTriangle, Edit } from 'lucide-react';
import { updateElectionDetails } from '@/services/electionManagementService';

const editElectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  option1: z.string().min(1, 'Option 1 is required').max(50, 'Option 1 too long'),
  option2: z.string().min(1, 'Option 2 is required').max(50, 'Option 2 too long'),
  end_date: z.string().min(1, 'End date is required')
});

type EditElectionForm = z.infer<typeof editElectionSchema>;

interface ElectionEditFormProps {
  election: any;
  safeToEdit: boolean;
  onElectionUpdated: () => void;
}

const ElectionEditForm: React.FC<ElectionEditFormProps> = ({
  election,
  safeToEdit,
  onElectionUpdated
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty }
  } = useForm<EditElectionForm>({
    resolver: zodResolver(editElectionSchema),
    defaultValues: {
      title: election.title,
      description: election.description,
      option1: election.option1,
      option2: election.option2,
      end_date: new Date(election.end_date).toISOString().slice(0, 16)
    }
  });

  const onSubmit = async (data: EditElectionForm) => {
    if (!isDirty) {
      toast({
        title: "No changes detected",
        description: "Please make changes before saving.",
      });
      return;
    }

    if (!safeToEdit) {
      const confirmed = window.confirm(
        'This election already has votes. Are you sure you want to make changes? This could affect the integrity of the results.'
      );
      if (!confirmed) return;
    }

    try {
      setIsUpdating(true);

      const updates = {
        title: data.title,
        description: data.description,
        option1: data.option1,
        option2: data.option2,
        end_date: new Date(data.end_date).toISOString()
      };

      const success = await updateElectionDetails(election.id, updates);

      if (success) {
        toast({
          title: "Election updated",
          description: "The election details have been updated successfully.",
        });
        onElectionUpdated();
      } else {
        throw new Error("Failed to update election");
      }
    } catch (error) {
      console.error('Error updating election:', error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5 text-blue-600" />
          Edit Election Details
        </CardTitle>
        <CardDescription>
          Modify election information. Changes will be logged in the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!safeToEdit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This election already has votes. Changes to options or significant details may affect result integrity.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Election Title</Label>
              <Input
                id="title"
                {...register('title')}
                disabled={isUpdating}
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="datetime-local"
                {...register('end_date')}
                disabled={isUpdating}
              />
              {errors.end_date && (
                <p className="text-sm text-red-600">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              disabled={isUpdating}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="option1">Option 1</Label>
              <Input
                id="option1"
                {...register('option1')}
                disabled={isUpdating || !safeToEdit}
              />
              {errors.option1 && (
                <p className="text-sm text-red-600">{errors.option1.message}</p>
              )}
              {!safeToEdit && (
                <p className="text-xs text-amber-600">
                  Option changes are risky when votes exist
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2">Option 2</Label>
              <Input
                id="option2"
                {...register('option2')}
                disabled={isUpdating || !safeToEdit}
              />
              {errors.option2 && (
                <p className="text-sm text-red-600">{errors.option2.message}</p>
              )}
              {!safeToEdit && (
                <p className="text-xs text-amber-600">
                  Option changes are risky when votes exist
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isUpdating || !isDirty}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {isDirty && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. All modifications will be logged in the audit trail.
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default ElectionEditForm;
