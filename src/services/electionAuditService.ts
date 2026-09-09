
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { logger } from '@/services/logger';

/**
 * Record a successful authority authentication. The database derives the
 * actor and fixed action from auth.uid(); the client supplies details only.
 */
export async function logAuthorityAuthentication(
  details?: Json
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_authority_authentication', {
      p_details: details ?? {},
    });

    if (error) {
      logger.error('Error logging audit action:', error);
    }
  } catch (error) {
    logger.error('Error in logAuthorityAuthentication:', error);
  }
}
