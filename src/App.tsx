import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WalletProvider } from "@/contexts/WalletContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import NavBar from "@/components/NavBar"
import ConnectivityBanner from "@/components/ConnectivityBanner"
import AppFooter from "@/components/AppFooter"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { LoadingPanel } from "@/components/LoadingPanel"
import { MAIN_CONTENT_ID, RouteFocusManager, SkipLink } from "@/components/RouteFocusManager"

const Index = lazy(() => import("@/pages/Index"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Success = lazy(() => import("@/pages/Success"))
const Elections = lazy(() => import("@/pages/Elections"))
const ElectionDetail = lazy(() => import("@/pages/ElectionDetail"))
const ElectionAuthority = lazy(() => import("@/pages/ElectionAuthority"))
const HowItWorks = lazy(() => import("@/pages/HowItWorks"))
const FAQ = lazy(() => import("@/pages/FAQ"))
const NotFound = lazy(() => import("@/pages/NotFound"))
const VoteReceipt = lazy(() => import("@/pages/VoteReceipt"))
const Privacy = lazy(() => import("@/pages/Privacy"))
const AuditProtocol = lazy(() => import("@/pages/AuditProtocol"))

const queryClient = new QueryClient()
const LOOPBACK_IP_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"])

function getLocalhostUrl() {
  const { protocol, port, pathname, search, hash } = window.location
  const portSuffix = port ? `:${port}` : ""
  return `${protocol}//localhost${portSuffix}${pathname}${search}${hash}`
}

const App: React.FC = () => {
  const redirectUrl =
    typeof window !== "undefined" && LOOPBACK_IP_HOSTS.has(window.location.hostname)
      ? getLocalhostUrl()
      : null

  useEffect(() => {
    if (redirectUrl) {
      window.location.replace(redirectUrl)
    }
  }, [redirectUrl])

  if (redirectUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="ledger-panel max-w-lg px-8 py-10 text-center">
          <p className="ledger-eyebrow">Votex</p>
          <h1 className="mt-3 font-headline text-3xl font-bold text-primary">
            Redirecting to localhost
          </h1>
          <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
            Passkey authentication requires a valid WebAuthn relying-party hostname. Local development must use{" "}
            <span className="font-semibold text-primary">localhost</span>, not a loopback IP.
          </p>
          <a className="ledger-button-primary mt-6" href={redirectUrl}>
            Continue on localhost
          </a>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <BrowserRouter>
          <RouteFocusManager />
          <div className="ledger-shell flex min-h-screen flex-col pb-[var(--bottom-nav-h)]">
            <SkipLink />
            <NavBar />
            <ConnectivityBanner />
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
              <ErrorBoundary>
                <Suspense fallback={<LoadingPanel label="Loading page" />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/success" element={<ProtectedRoute><Success /></ProtectedRoute>} />
                    <Route path="/elections" element={<Elections />} />
                    <Route path="/elections/:id" element={<ElectionDetail />} />
                    <Route path="/receipts/:receiptId" element={<VoteReceipt />} />
                    <Route path="/elections/:id/authority" element={<ElectionAuthority />} />
                    <Route path="/election_authority" element={<ElectionAuthority />} />
                    <Route path="/how-it-works" element={<HowItWorks />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/audit-protocol" element={<AuditProtocol />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <AppFooter />
          </div>
          <Toaster />
        </BrowserRouter>
      </WalletProvider>
    </QueryClientProvider>
  )
}

export default App
