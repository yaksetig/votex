
import { supabase } from '@/integrations/supabase/client';
import { logElectionAuthorityAction } from '@/services/electionAuditService';

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
