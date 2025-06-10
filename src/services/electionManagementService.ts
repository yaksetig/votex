
import { supabase } from '@/integrations/supabase/client';
import { EdwardsPoint } from '@/services/elGamalService';
import { generateKeypair } from '@/services/keypairService';

export interface ElectionManagementSession {
  electionId: string;
  sessionToken: string;
  authenticatedAt: string;
  expiresAt: string;
}

export interface AuditLogEntry {
  action: string;
  performed_by: string;
  details?: any;
}

// Verify private key against stored public key for election authority
export async function authenticateElectionAuthority(
  electionId: string,
  privateKey: string
): Promise<boolean> {
  try {
    console.log(`Authenticating election authority for election: ${electionId}`);
    
    // Get the election and its authority
    const { data: election, error } = await supabase
      .from('elections')
      .select(`
        *,
        election_authorities (
          id,
          name,
          public_key_x,
          public_key_y
        )
      `)
      .eq('id', electionId)
      .maybeSingle();

    if (error || !election || !election.election_authorities) {
      console.error('Election or authority not found:', error);
      return false;
    }

    // Derive public key from provided private key
    const privateKeyBigInt = BigInt(privateKey);
    const derivedPublicKey = EdwardsPoint.generator().multiply(privateKeyBigInt);
    
    // Compare with stored public key
    const storedPublicKeyX = BigInt(election.election_authorities.public_key_x);
    const storedPublicKeyY = BigInt(election.election_authorities.public_key_y);
    
    const isValid = derivedPublicKey.x === storedPublicKeyX && derivedPublicKey.y === storedPublicKeyY;
    
    if (isValid) {
      console.log('Election authority authentication successful');
      // Log the authentication
      await logElectionAuthorityAction(electionId, 'AUTHENTICATION', 'Election Authority', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('Election authority authentication failed');
    }
    
    return isValid;
  } catch (error) {
    console.error('Error during election authority authentication:', error);
    return false;
  }
}

// Create a secure session for authenticated election authority
export function createElectionAuthoritySession(electionId: string): ElectionManagementSession {
  const sessionToken = generateSessionToken();
  const authenticatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
  
  const session = {
    electionId,
    sessionToken,
    authenticatedAt,
    expiresAt
  };
  
  // Store session in localStorage (could be enhanced with more secure storage)
  localStorage.setItem('election_authority_session', JSON.stringify(session));
  
  return session;
}

// Validate existing session
export function validateElectionAuthoritySession(electionId: string): boolean {
  try {
    const sessionData = localStorage.getItem('election_authority_session');
    if (!sessionData) return false;
    
    const session: ElectionManagementSession = JSON.parse(sessionData);
    
    // Check if session is for the correct election and not expired
    if (session.electionId !== electionId) return false;
    if (new Date() > new Date(session.expiresAt)) {
      clearElectionAuthoritySession();
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Clear session
export function clearElectionAuthoritySession(): void {
  localStorage.removeItem('election_authority_session');
}

// Generate a random session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Close election early
export async function closeElectionEarly(
  electionId: string,
  performedBy: string = 'Election Authority'
): Promise<boolean> {
  try {
    console.log(`Closing election early: ${electionId}`);
    
    const { error } = await supabase
      .from('elections')
      .update({
        status: 'closed_manually',
        closed_manually_at: new Date().toISOString(),
        end_date: new Date().toISOString(), // Set end_date to now
        last_modified_by: performedBy
      })
      .eq('id', electionId);

    if (error) {
      console.error('Error closing election:', error);
      return false;
    }

    await logElectionAuthorityAction(electionId, 'CLOSE_ELECTION', performedBy, {
      closed_at: new Date().toISOString(),
      reason: 'Manual closure by election authority'
    });

    return true;
  } catch (error) {
    console.error('Error in closeElectionEarly:', error);
    return false;
  }
}

// Update election details
export async function updateElectionDetails(
  electionId: string,
  updates: {
    title?: string;
    description?: string;
    option1?: string;
    option2?: string;
    end_date?: string;
  },
  performedBy: string = 'Election Authority'
): Promise<boolean> {
  try {
    console.log(`Updating election details: ${electionId}`, updates);
    
    const { error } = await supabase
      .from('elections')
      .update({
        ...updates,
        last_modified_by: performedBy
      })
      .eq('id', electionId);

    if (error) {
      console.error('Error updating election:', error);
      return false;
    }

    await logElectionAuthorityAction(electionId, 'UPDATE_ELECTION', performedBy, {
      updates,
      updated_at: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Error in updateElectionDetails:', error);
    return false;
  }
}

// Check if election is safe to edit (no votes yet)
export async function isElectionSafeToEdit(electionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('votes')
      .select('id')
      .eq('election_id', electionId)
      .limit(1);

    if (error) {
      console.error('Error checking votes:', error);
      return false;
    }

    return (data?.length || 0) === 0;
  } catch (error) {
    console.error('Error in isElectionSafeToEdit:', error);
    return false;
  }
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
