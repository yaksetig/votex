import PasskeyRegistration from '@/components/PasskeyRegistration';
import { useWallet } from '@/contexts/WalletContext';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { isWorldIDVerified } = useWallet();

  // If already verified, redirect to elections
  if (isWorldIDVerified) {
    return <Navigate to="/elections" replace />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome to Votex</h1>
          <p className="text-muted-foreground">
            Anonymous, verifiable voting powered by passkeys and World ID.
          </p>
        </div>
        
        <PasskeyRegistration />
      </div>
    </div>
  );
};

export default Index;