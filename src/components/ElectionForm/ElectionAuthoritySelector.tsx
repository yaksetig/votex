
import React from "react";
import { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ElectionAuthority } from "@/services/electionAuthorityService";

interface ElectionAuthoritySelectorProps {
  authorities: ElectionAuthority[];
  loadingAuthorities: boolean;
  createNewAuthority: boolean;
  setCreateNewAuthority: (value: boolean) => void;
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
}

const ElectionAuthoritySelector: React.FC<ElectionAuthoritySelectorProps> = ({
  authorities,
  loadingAuthorities,
  createNewAuthority,
  setCreateNewAuthority,
  register,
  setValue,
}) => {
  return (
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
  );
};

export default ElectionAuthoritySelector;
