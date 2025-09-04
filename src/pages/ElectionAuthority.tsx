
import React, { useState, useEffect } from 'react';
import ElectionAuthorityLogin from '@/components/ElectionAuthorityLogin';
import ElectionAuthorityInterface from '@/components/ElectionAuthorityInterface';
import AuthorityElectionsList from '@/components/AuthorityElectionsList';
import { validateElectionAuthoritySession, clearElectionAuthoritySession } from '@/services/electionManagementService';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ElectionAuthority = () => {
  const [authorityId, setAuthorityId] = useState<string | null>(null);
  const [authorityName, setAuthorityName] = useState<string | null>(null);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if there's an existing valid session
    const checkExistingSession = () => {
      try {
        const sessionValidation = validateElectionAuthoritySession();
        if (sessionValidation.valid && sessionValidation.authorityId) {
          setAuthorityId(sessionValidation.authorityId);
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleLoginSuccess = (authId: string, authName: string) => {
    setAuthorityId(authId);
    setAuthorityName(authName);
  };

  const handleLogout = () => {
    clearElectionAuthoritySession();
    setAuthorityId(null);
    setAuthorityName(null);
    setSelectedElectionId(null);
    toast({
      title: "Logged out",
      description: "You have been securely logged out.",
    });
  };

  const handleElectionSelect = (electionId: string) => {
    setSelectedElectionId(electionId);
  };

  const handleBackToElectionsList = () => {
    setSelectedElectionId(null);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-lg text-white">Checking session...</div>
      </div>
    );
  }

  // If not authenticated, show login
  if (!authorityId) {
    return <ElectionAuthorityLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // If authenticated but no election selected, show elections list
  if (!selectedElectionId) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg border-b border-slate-600">
          <div className="container mx-auto py-4 px-4 flex justify-between items-center">
            <div className="text-lg font-semibold text-white">Election Authority Portal</div>
            <Button onClick={handleLogout} variant="secondary" size="sm" className="bg-slate-600 text-white hover:bg-slate-500 border-slate-500">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
        <AuthorityElectionsList
          authorityId={authorityId}
          authorityName={authorityName || 'Election Authority'}
          onElectionSelect={handleElectionSelect}
        />
      </div>
    );
  }

  // If election selected, show election management dashboard
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg border-b border-slate-600">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <Button onClick={handleBackToElectionsList} variant="secondary" size="sm" className="bg-slate-600 text-white hover:bg-slate-500 border-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Elections List
          </Button>
          <Button onClick={handleLogout} variant="secondary" size="sm" className="bg-slate-600 text-white hover:bg-slate-500 border-slate-500">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <div className="p-8">
        <ElectionAuthorityInterface
          electionId={selectedElectionId!}
          electionTitle="Election Management"
        />
      </div>
    </div>
  );
};

export default ElectionAuthority;
