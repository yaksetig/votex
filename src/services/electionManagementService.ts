
// Main election management service - now acts as a facade for the smaller services
// This maintains backward compatibility while the codebase is refactored

// Re-export authentication functionality
export {
  authenticateElectionAuthorityByKey
} from './electionAuthorityAuthService';

// Re-export session management functionality
export type {
  ElectionManagementSession
} from './electionAuthoritySessionService';
export {
  createElectionAuthoritySession,
  validateElectionAuthoritySession,
  clearElectionAuthoritySession
} from './electionAuthoritySessionService';

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
