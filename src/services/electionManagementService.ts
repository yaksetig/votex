
// Main election management service - facade re-exporting smaller services.

// Re-export authentication functionality
export {
  signInAuthority,
  signUpAuthority,
  signOutAuthority,
  getCurrentAuthority,
} from './electionAuthorityAuthService';
export type { AuthorityAuthResult } from './electionAuthorityAuthService';

// Re-export session management functionality
export {
  validateElectionAuthoritySession,
  clearElectionAuthoritySession,
  onAuthorityAuthStateChange,
} from './electionAuthoritySessionService';
export type { ElectionAuthoritySessionInfo } from './electionAuthoritySessionService';

// Re-export election operations functionality
export {
  closeElectionEarly,
  updateElectionDetails,
  isElectionSafeToEdit
} from './electionOperationsService';

// Re-export audit functionality
export type {
  AuditLogEntry
} from './electionAuditService';
export {
  logElectionAuthorityAction,
  getElectionAuditLog
} from './electionAuditService';

// Re-export data fetching functionality
export type {
  AuthorityElection
} from './electionDataService';
export {
  getElectionsForAuthority
} from './electionDataService';
