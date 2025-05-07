
import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WagmiProvider } from 'wagmi'
import { ConnectKitProvider } from 'connectkit'
import { WalletProvider } from "@/contexts/WalletContext"
import { ElectionProvider } from "@/providers/ElectionProvider"
import { wagmiConfig } from "@/utils/wagmiConfig"
import NavBar from "@/components/NavBar"
import Dashboard from "@/pages/Dashboard"
import NotFound from "./pages/NotFound"

const queryClient = new QueryClient()

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <ConnectKitProvider>
        <TooltipProvider>
          <WalletProvider>
            <ElectionProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <div className="min-h-screen flex flex-col">
                  <NavBar />
                  <main className="flex-1">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </BrowserRouter>
            </ElectionProvider>
          </WalletProvider>
        </TooltipProvider>
      </ConnectKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)

export default App
