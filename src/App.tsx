
import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WalletProvider } from "@/contexts/WalletContext"
import NavBar from "@/components/NavBar"
import Index from "@/pages/Index"
import Dashboard from "@/pages/Dashboard"
import Success from "@/pages/Success"
import Elections from "@/pages/Elections"
import ElectionDetail from "@/pages/ElectionDetail"
import NotFound from "@/pages/NotFound"

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/success" element={<Success />} />
                <Route path="/elections" element={<Elections />} />
                <Route path="/elections/:id" element={<ElectionDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
