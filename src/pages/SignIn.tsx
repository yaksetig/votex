import { Suspense, lazy, useRef } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LoadingPanel } from "@/components/LoadingPanel";
import { ROUTES, safeNextPath } from "@/lib/routes";

const WorldIDSignIn = lazy(() => import("@/components/WorldIDSignIn"));

/**
 * Sign-in only. A voter who arrives already signed in is sent on to `?next=`
 * (or their profile), so this page never doubles as a profile. The check
 * happens once, on arrival: completing sign-in on this page must not yank
 * the voter away from the confirmation step, which owns the next move.
 */
const SignIn = () => {
  usePageTitle("Sign in");
  const { isAuthLoading, isWorldIDVerified, userId } = useWallet();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), ROUTES.profile);
  const arrivedSignedIn = useRef<boolean | null>(null);

  if (isAuthLoading) {
    return <LoadingPanel label="Checking your session" />;
  }
  if (arrivedSignedIn.current === null) {
    arrivedSignedIn.current = isWorldIDVerified && Boolean(userId);
  }
  if (arrivedSignedIn.current) {
    return <Navigate to={next} replace />;
  }
  return (
    <Suspense fallback={<LoadingPanel label="Loading sign-in" />}>
      <WorldIDSignIn />
    </Suspense>
  );
};

export default SignIn;
