
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { logger } from '@/services/logger';

export interface AuditLogEntry {
  action: string;
  performed_by: string;
  details?: Json;
}

/**
 * Log an election authority action for the audit trail.
 *
 * `electionId` may be a UUID (for election-specific actions) or 'GLOBAL'
 * for system-level events such as AUTHENTICATION.  'GLOBAL' is stored as
 * NULL in the database because the column is UUID-typed.
 */
export async function logElectionAuthorityAction(
  electionId: string,
  action: string,
  performedBy: string,
  details?: Json
): Promise<void> {
  try {
    // Resolve the current auth user id (may be null if called before sign-in completes)
    let authUserId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      authUserId = session?.user?.id ?? null;
    } catch {
      // best-effort — don't block the audit write
    }

    const { error } = await supabase
      .from('election_authority_audit_log')
      .insert({
        election_id: electionId === 'GLOBAL' ? null : electionId,
        action,
        performed_by: performedBy,
        auth_user_id: authUserId,
        details
      });

    if (error) {
      logger.error('Error logging audit action:', error);
    }
  } catch (error) {
    logger.error('Error in logElectionAuthorityAction:', error);
  }
}

// Get audit log for an election
export async function getElectionAuditLog(electionId: string): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('election_authority_audit_log')
      .select('*')
      .eq('election_id', electionId)
      .order('performed_at', { ascending: false });

    if (error) {
      logger.error('Error fetching audit log:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error in getElectionAuditLog:', error);
    return [];
  }
}
