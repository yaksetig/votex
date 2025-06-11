
import { supabase } from '@/integrations/supabase/client';
import { EdwardsPoint } from '@/services/elGamalService';
import { logElectionAuthorityAction } from '@/services/electionAuditService';

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
