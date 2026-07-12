import { supabase } from "@/integrations/supabase/client";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import {
  readFunctionError,
  type CreateElectionResponse,
  VotexApiError,
} from "@/types/api";
import type { FormData } from "@/components/ElectionForm/types";

export async function createElection(form: FormData): Promise<CreateElectionResponse> {
  const sessionToken = getStoredWorldIdSessionToken();
  if (!sessionToken) {
    throw new VotexApiError(
      "SESSION_REQUIRED",
      "Sign in with World ID before creating an election."
    );
  }

  const { data, error } = await supabase.functions.invoke("create-election", {
    body: {
      sessionToken,
      title: form.title,
      description: form.description,
      option1: form.option1,
      option2: form.option2,
      endDate: form.endDate.toISOString(),
      idempotencyKey: crypto.randomUUID(),
    },
  });

  if (error) {
    throw await readFunctionError(
      error,
      "CONFLICT",
      "The election could not be created."
    );
  }

  if (!data?.election || !data?.authorityId) {
    throw new VotexApiError("CONFLICT", "The election response was incomplete.");
  }

  return data as CreateElectionResponse;
}
