
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  action: string;
  performed_by: string;
  details?: any;
}

// Log election authority actions for audit trail
export async function logElectionAuthorityAction(
  electionId: string,
  action: string,
  performedBy: string,
  details?: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from('election_authority_audit_log')
      .insert({
        election_id: electionId,
        action,
        performed_by: performedBy,
        details
      });

    if (error) {
      console.error('Error logging audit action:', error);
    }
  } catch (error) {
    console.error('Error in logElectionAuthorityAction:', error);
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
      console.error('Error fetching audit log:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getElectionAuditLog:', error);
    return [];
  }
}
