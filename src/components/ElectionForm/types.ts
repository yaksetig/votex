
import * as z from "zod";
import { electionFieldSchemas } from "./schema";

export const formSchema = z.object({
  ...electionFieldSchemas,
  endDate: z.date().refine((date) => date > new Date(), {
    message: "End date must be in the future",
  }),
});

export type FormData = z.infer<typeof formSchema>;

export interface ElectionFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}
