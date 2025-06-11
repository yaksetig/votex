import { supabase } from '@/integrations/supabase/client';
import { EdwardsPoint } from '@/services/elGamalService';
import { generateKeypair } from '@/services/babyJubjubService';

export interface ElectionManagementSession {
  authorityId: string;
  sessionToken: string;
  authenticatedAt: string;
  expiresAt: string;
}

export interface AuthorityElection {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  end_date: string;
  closed_manually_at?: string;
  option1: string;
  option2: string;
  vote_count?: number;
}

export interface AuditLogEntry {
  action: string;
  performed_by: string;
  details?: any;
}

// Authenticate election authority by private key only
export async function authenticateElectionAuthorityByKey(
  privateKey: string
): Promise<{ success: boolean; authorityId?: string; authorityName?: string }> {
  try {
    console.log('Authenticating election authority by private key...');
    
    // Derive public key from provided private key
    const privateKeyBigInt = BigInt(privateKey);
    const derivedPublicKey = EdwardsPoint.base().multiply(privateKeyBigInt);
    
    // Find matching election authority
    const { data: authorities, error } = await supabase
      .from('election_authorities')
      .select('*');

    if (error) {
      console.error('Error fetching election authorities:', error);
      return { success: false };
    }

    // Find authority with matching public key
    const matchingAuthority = authorities?.find(auth => {
      const storedPublicKeyX = BigInt(auth.public_key_x);
      const storedPublicKeyY = BigInt(auth.public_key_y);
      return derivedPublicKey.x === storedPublicKeyX && derivedPublicKey.y === storedPublicKeyY;
    });

    if (matchingAuthority) {
      console.log('Election authority authentication successful');
      // Log the authentication
      await logElectionAuthorityAction('GLOBAL', 'AUTHENTICATION', matchingAuthority.name, {
        authority_id: matchingAuthority.id,
        timestamp: new Date().toISOString()
      });
      
      return { 
        success: true, 
        authorityId: matchingAuthority.id,
        authorityName: matchingAuthority.name
      };
    } else {
      console.log('Election authority authentication failed - no matching public key');
      return { success: false };
    }
  } catch (error) {
    console.error('Error during election authority authentication:', error);
    return { success: false };
  }
}

// Get all elections for an election authority
export async function getElectionsForAuthority(authorityId: string): Promise<AuthorityElection[]> {
  try {
    console.log(`Fetching elections for authority: ${authorityId}`);
    
    const { data: elections, error } = await supabase
      .from('elections')
      .select(`
        *,
        votes(id)
      `)
      .eq('authority_id', authorityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching elections:', error);
      return [];
    }

    // Process elections to add vote counts and determine status
    const processedElections: AuthorityElection[] = elections?.map(election => {
      const now = new Date();
      const endDate = new Date(election.end_date);
      
      let status = election.status || 'active';
      if (election.closed_manually_at) {
        status = 'closed_manually';
      } else if (now > endDate) {
        status = 'expired';
      }

      return {
        id: election.id,
        title: election.title,
        description: election.description,
        status,
        created_at: election.created_at,
        end_date: election.end_date,
        closed_manually_at: election.closed_manually_at,
        option1: election.option1,
        option2: election.option2,
        vote_count: election.votes?.length || 0
      };
    }) || [];

    console.log(`Found ${processedElections.length} elections for authority`);
    return processedElections;
  } catch (error) {
    console.error('Error in getElectionsForAuthority:', error);
    return [];
  }
}

// Create a secure session for authenticated election authority
export function createElectionAuthoritySession(authorityId: string): ElectionManagementSession {
  const sessionToken = generateSessionToken();
  const authenticatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
  
  const session = {
    authorityId,
    sessionToken,
    authenticatedAt,
    expiresAt
  };
  
  // Store session in localStorage
  localStorage.setItem('election_authority_session', JSON.stringify(session));
  
  return session;
}

// Validate existing session
export function validateElectionAuthoritySession(): { valid: boolean; authorityId?: string } {
  try {
    const sessionData = localStorage.getItem('election_authority_session');
    if (!sessionData) return { valid: false };
    
    const session: ElectionManagementSession = JSON.parse(sessionData);
    
    // Check if session is not expired
    if (new Date() > new Date(session.expiresAt)) {
      clearElectionAuthoritySession();
      return { valid: false };
    }
    
    return { valid: true, authorityId: session.authorityId };
  } catch {
    return { valid: false };
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

// Close election early - enhanced with better RLS handling
export async function closeElectionEarly(
  electionId: string,
  performedBy: string = 'Election Authority'
): Promise<boolean> {
  try {
    console.log(`Starting election closure process for election: ${electionId}`);
    
    const now = new Date().toISOString();
    
    // First, fetch the current election to verify it exists and we have authority
    const { data: currentElection, error: fetchError } = await supabase
      .from('elections')
      .select('id, title, status, end_date, closed_manually_at, authority_id')
      .eq('id', electionId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching election before closure:', fetchError);
      return false;
    }
    
    if (!currentElection) {
      console.error('Election not found:', electionId);
      return false;
    }
    
    console.log('Current election state before closure:', currentElection);
    
    // Update the election with proper closure fields
    // The RLS policy will now properly allow this update for election authorities
    const { data: updatedElection, error: updateError } = await supabase
      .from('elections')
      .update({
        status: 'closed_manually',
        closed_manually_at: now,
        end_date: now,
        last_modified_by: performedBy,
        last_modified_at: now
      })
      .eq('id', electionId)
      .select('id, title, status, end_date, closed_manually_at, last_modified_at');

    if (updateError) {
      console.error('Error updating election during closure:', updateError);
      console.error('Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      return false;
    }

    console.log('Election successfully updated:', updatedElection);

    // Verify the update actually happened by fetching the election again
    const { data: verificationData, error: verificationError } = await supabase
      .from('elections')
      .select('id, title, status, end_date, closed_manually_at, last_modified_at')
      .eq('id', electionId)
      .single();
      
    if (verificationError) {
      console.error('Error verifying election closure:', verificationError);
      return false;
    }
    
    console.log('Verified election state after closure:', verificationData);
    
    // Check if the status was actually updated
    if (verificationData.status !== 'closed_manually') {
      console.error('Election status was not updated properly. Expected: closed_manually, Got:', verificationData.status);
      return false;
    }

    // Log the action for audit trail
    await logElectionAuthorityAction(electionId, 'CLOSE_ELECTION', performedBy, {
      closed_at: now,
      reason: 'Manual closure by election authority',
      previous_status: currentElection.status,
      new_status: 'closed_manually'
    });

    console.log('Election closure completed successfully');
    return true;
  } catch (error) {
    console.error('Unexpected error in closeElectionEarly:', error);
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
