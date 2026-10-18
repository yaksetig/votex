import * as z from "zod";
import { DISTINCT_OPTIONS_MESSAGE, electionFieldSchemas, optionsAreDistinct } from "./schema";

export const formSchema = z
  .object({
    ...electionFieldSchemas,
    endDate: z.date({ invalid_type_error: "Choose a closing date and time" }).refine((date) => date > new Date(), {
      message: "Choose a closing date in the future",
    }),
  })
  .refine((values) => optionsAreDistinct(values.option1, values.option2), {
    message: DISTINCT_OPTIONS_MESSAGE,
    path: ["option2"],
  });

export type FormData = z.infer<typeof formSchema>;

export interface ElectionFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}
