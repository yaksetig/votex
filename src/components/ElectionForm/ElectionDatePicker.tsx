
import React from "react";
import { UseFormSetValue, FieldErrors } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface ElectionDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
}

const ElectionDatePicker: React.FC<ElectionDatePickerProps> = ({
  date,
  setDate,
  setValue,
  errors,
}) => {
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      setValue("endDate", selectedDate, { shouldValidate: true });
    }
  };

  return (
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
        <p className="text-sm text-red-500">{String(errors.endDate.message)}</p>
      )}
    </div>
  );
};

export default ElectionDatePicker;
