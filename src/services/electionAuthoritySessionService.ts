
export interface ElectionManagementSession {
  authorityId: string;
  sessionToken: string;
  authenticatedAt: string;
  expiresAt: string;
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
