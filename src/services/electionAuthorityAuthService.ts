
import { supabase } from '@/integrations/supabase/client';
import { logElectionAuthorityAction } from '@/services/electionAuditService';
import { logger } from '@/services/logger';

export interface AuthorityAuthResult {
  success: boolean;
  authorityId?: string;
  authorityName?: string;
  error?: string;
  requiresAuthorityLink?: boolean;
}

/**
 * Sign in an election authority using Supabase Auth (email + password).
 * After sign-in, looks up the authority row linked to that auth user.
 */
export async function signInAuthority(
  email: string,
  password: string
): Promise<AuthorityAuthResult> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      logger.error('Authority sign-in failed:', authError);
      return { success: false, error: authError?.message ?? 'Sign-in failed' };
    }

    const userId = authData.user.id;

    // Look up the linked authority row
    const { data: authority, error: lookupError } = await supabase
      .from('election_authorities')
      .select('id, name')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (lookupError) {
      logger.error('Error looking up authority for auth user:', lookupError);
      return { success: false, error: 'Failed to look up authority record' };
    }

    if (!authority) {
      return {
        success: false,
        error: 'This account is authenticated but not linked to an authority yet.',
        requiresAuthorityLink: true,
      };
    }

    await logElectionAuthorityAction('GLOBAL', 'AUTHENTICATION', authority.name, {
      authority_id: authority.id,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      authorityId: authority.id,
      authorityName: authority.name,
    };
  } catch (error) {
    logger.error('Unexpected error during authority sign-in:', error);
    return { success: false, error: 'Unexpected error during sign-in' };
  }
}

/**
 * Register a new Supabase Auth account for an authority and link it to
 * the authority row identified by its BabyJubJub public key.
 *
 * This is a one-time setup step: the authority proves they own the key,
 * then future logins use email/password only.
 */
export async function signUpAuthority(
  email: string,
  password: string,
  authorityName: string,
  authorityPrivateKey: string
): Promise<AuthorityAuthResult> {
  try {
    // 1. Create the auth account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !authData.user) {
      logger.error('Authority sign-up failed:', signUpError);
      return { success: false, error: signUpError?.message ?? 'Sign-up failed' };
    }

    if (!authData.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session || !signInData.user) {
        logger.warn('Authority account created but no active session is available for linking');
        return {
          success: false,
          error: 'Account created. Confirm your email if required, then sign in again to complete authority linking.',
        };
      }
    }

    return await linkCurrentAuthorityIdentity(authorityName, authorityPrivateKey);
  } catch (error) {
    logger.error('Unexpected error during authority sign-up:', error);
    return { success: false, error: 'Unexpected error during sign-up' };
  }
}

export async function linkCurrentAuthorityIdentity(
  authorityName: string,
  authorityPrivateKey: string
): Promise<AuthorityAuthResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user || !session.access_token) {
      return {
        success: false,
        error: 'You must be signed in before linking an authority identity.',
      };
    }

    const { createAuthorityOwnershipProof } = await import('@/services/authorityOwnershipProofService');

    const proof = await createAuthorityOwnershipProof(
      session.user.id,
      authorityName,
      authorityPrivateKey
    );

    const { data, error } = await supabase.functions.invoke('authority-link', {
      body: {
        action: 'link',
        authorityName,
        issuedAt: proof.issuedAt,
        publicKeyX: proof.publicKeyX,
        publicKeyY: proof.publicKeyY,
        signature: proof.signature,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      logger.error('Authority link function failed:', error);
      return { success: false, error: error.message ?? 'Failed to link authority identity' };
    }

    if (data?.error || !data?.authorityId || !data?.authorityName) {
      return {
        success: false,
        error: data?.error ?? 'Authority link response was incomplete',
      };
    }

    return {
      success: true,
      authorityId: data.authorityId,
      authorityName: data.authorityName,
    };
  } catch (error) {
    logger.error('Unexpected error during authority link:', error);
    return { success: false, error: 'Unexpected error during authority link' };
  }
}

/**
 * Sign out the current authority (clears the Supabase Auth session).
 */
export async function signOutAuthority(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get the authority record for the currently authenticated Supabase Auth user.
 * Returns null if not signed in or no authority row is linked.
 */
export async function getCurrentAuthority(): Promise<{
  authorityId: string;
  authorityName: string;
} | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: authority, error } = await supabase
      .from('election_authorities')
      .select('id, name')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error || !authority) return null;

    return { authorityId: authority.id, authorityName: authority.name };
  } catch {
    return null;
  }
}
