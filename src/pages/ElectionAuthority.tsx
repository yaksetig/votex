
import React, { useState, useEffect } from 'react';
import ElectionAuthorityLogin from '@/components/ElectionAuthorityLogin';
import ElectionAuthorityDashboard from '@/components/ElectionAuthorityDashboard';
import { validateElectionAuthoritySession } from '@/services/electionManagementService';

const ElectionAuthority = () => {
  const [authenticatedElectionId, setAuthenticatedElectionId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if there's an existing valid session
    const checkExistingSession = () => {
      try {
        const sessionData = localStorage.getItem('election_authority_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (validateElectionAuthoritySession(session.electionId)) {
            setAuthenticatedElectionId(session.electionId);
          }
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleLoginSuccess = (electionId: string) => {
    setAuthenticatedElectionId(electionId);
  };

  const handleLogout = () => {
    setAuthenticatedElectionId(null);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Checking session...</div>
      </div>
    );
  }

  if (authenticatedElectionId) {
    return (
      <ElectionAuthorityDashboard
        electionId={authenticatedElectionId}
        onLogout={handleLogout}
      />
    );
  }

  return <ElectionAuthorityLogin onLoginSuccess={handleLoginSuccess} />;
};

export default ElectionAuthority;
