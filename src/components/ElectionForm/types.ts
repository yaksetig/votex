
import * as z from "zod";

export const formSchema = z.object({
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

export type FormData = z.infer<typeof formSchema>;

export interface ElectionFormProps {
  onSubmit: (data: FormData & { authorityId?: string }) => void;
  onCancel: () => void;
}
