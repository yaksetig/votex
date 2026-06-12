
import * as z from "zod";
import { electionFieldSchemas } from "./schema";

export const formSchema = z.object({
  ...electionFieldSchemas,
  endDate: z.date().refine((date) => date > new Date(), {
    message: "End date must be in the future",
  }),
  authorityId: z.string().optional(),
  newAuthorityName: z.string().optional(),
  newAuthorityDescription: z.string().optional(),
});

export type FormData = z.infer<typeof formSchema>;

export interface ElectionFormProps {
  onSubmit: (data: FormData & { authorityId?: string }) => void;
  onCancel: () => void;
}
