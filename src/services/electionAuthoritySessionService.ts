
import { supabase } from '@/integrations/supabase/client';

export interface ElectionAuthoritySessionInfo {
  valid: boolean;
  authorityId?: string;
  authUserId?: string;
}

/**
 * Validate the current authority session by checking the Supabase Auth JWT
 * and resolving the linked election_authorities row.
 *
 * This replaces the old localStorage-based session.  The JWT is verified by
 * Supabase on every API call, so there is no client-forgeable token.
 */
export async function validateElectionAuthoritySession(): Promise<ElectionAuthoritySessionInfo> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { valid: false };

    const { data: authority, error } = await supabase
      .from('election_authorities')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error || !authority) return { valid: false };

    return { valid: true, authorityId: authority.id, authUserId: session.user.id };
  } catch {
    return { valid: false };
  }
}

/**
 * Clear the authority session (signs out of Supabase Auth).
 */
export async function clearElectionAuthoritySession(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Subscribe to auth state changes.  Returns an unsubscribe function.
 */
export function onAuthorityAuthStateChange(
  callback: (event: string, session: unknown) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
