
import React from "react";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface ElectionBasicDetailsData {
  title: string;
  description: string;
  option1: string;
  option2: string;
}

interface ElectionBasicDetailsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

const ElectionBasicDetails: React.FC<ElectionBasicDetailsProps> = ({
  register,
  errors,
}) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Election Title</Label>
        <Input
          id="title"
          placeholder="Enter the election title"
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{String(errors.title.message)}</p>
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
          <p className="text-sm text-red-500">{String(errors.description.message)}</p>
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
            <p className="text-sm text-red-500">{String(errors.option1.message)}</p>
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
            <p className="text-sm text-red-500">{String(errors.option2.message)}</p>
          )}
        </div>
      </div>
    </>
  );
};

export default ElectionBasicDetails;
