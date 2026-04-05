import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WalletProvider } from "@/contexts/WalletContext"
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider"
import ProtectedRoute from "@/components/ProtectedRoute"
import NavBar from "@/components/NavBar"

const Index = lazy(() => import("@/pages/Index"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Success = lazy(() => import("@/pages/Success"))
const Elections = lazy(() => import("@/pages/Elections"))
const ElectionDetail = lazy(() => import("@/pages/ElectionDetail"))
const ElectionAuthority = lazy(() => import("@/pages/ElectionAuthority"))
const HowItWorks = lazy(() => import("@/pages/HowItWorks"))
const NotFound = lazy(() => import("@/pages/NotFound"))

const queryClient = new QueryClient()
const LOOPBACK_IP_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"])

function getLocalhostUrl() {
  const { protocol, port, pathname, search, hash } = window.location
  const portSuffix = port ? `:${port}` : ""
  return `${protocol}//localhost${portSuffix}${pathname}${search}${hash}`
}

const RouteLoading = () => (
  <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10">
    <div className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
      <p className="ledger-eyebrow">Votex</p>
      <h1 className="mt-3 font-headline text-3xl font-bold text-primary">
        Loading interface
      </h1>
    </div>
  </div>
)

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

  return (
    <MiniKitProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <Toaster />
          <Sonner />
          {redirectUrl ? (
            <div className="flex min-h-screen items-center justify-center px-4 py-10">
              <div className="max-w-lg rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
                <p className="ledger-eyebrow">Votex</p>
                <h1 className="mt-3 font-headline text-3xl font-bold text-primary">
                  Redirecting to localhost
                </h1>
                <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
                  Passkey authentication requires a valid WebAuthn relying-party hostname. Local development must use{" "}
                  <span className="font-semibold text-primary">localhost</span>, not a loopback IP.
                </p>
                <a
                  className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-on-primary transition hover:brightness-110"
                  href={redirectUrl}
                >
                  Continue on localhost
                </a>
              </div>
            </div>
          ) : (
            <BrowserRouter
              future={{
                v7_relativeSplatPath: true,
                v7_startTransition: true,
              }}
            >
              <div className="ledger-shell flex min-h-[100dvh] flex-col">
                <NavBar />
                <main className="flex-1">
                  <Suspense fallback={<RouteLoading />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/success" element={<ProtectedRoute><Success /></ProtectedRoute>} />
                      <Route path="/elections" element={<Elections />} />
                      <Route path="/elections/:id" element={<ElectionDetail />} />
                      <Route path="/elections/:id/authority" element={<ProtectedRoute><ElectionAuthority /></ProtectedRoute>} />
                      <Route path="/election_authority" element={<ProtectedRoute><ElectionAuthority /></ProtectedRoute>} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
              </div>
            </BrowserRouter>
          )}
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </MiniKitProvider>
  )
}

export default App
