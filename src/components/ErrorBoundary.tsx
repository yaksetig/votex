import React from "react";
import { logger } from "@/services/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors and failed lazy chunks (typically after a deploy
 * replaces hashed bundles) so the voter sees a reload prompt instead of a
 * blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    logger.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10" role="alert">
        <div className="ledger-panel max-w-lg px-8 py-10 text-center">
          <p className="ledger-eyebrow">Votex</p>
          <h1 className="mt-3 font-headline text-3xl font-bold text-primary">Something went wrong</h1>
          <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
            This page could not be shown. Reloading usually fixes it. Nothing you submitted was lost: ballots,
            delegations and nullification requests are only recorded once the server confirms them.
          </p>
          <button
            type="button"
            className="ledger-button-primary mt-6"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
