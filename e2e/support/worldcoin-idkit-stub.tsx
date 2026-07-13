import React from "react";

/* eslint-disable react-refresh/only-export-components -- the real package co-locates its component, helpers, and types */

export interface IDKitResult {
  responses: Array<{ nullifier: string }>;
}

export interface RpContext {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
}

interface IDKitRequestWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleVerify: (result: IDKitResult) => Promise<void>;
  onSuccess: (result: IDKitResult) => Promise<void>;
  onError: (error: unknown) => void;
  autoClose?: boolean;
}

export function orbLegacy<T>(preset: T): T {
  return preset;
}

export function IDKitRequestWidget({
  open,
  onOpenChange,
  handleVerify,
  onSuccess,
  onError,
  autoClose,
}: IDKitRequestWidgetProps) {
  if (!open) return null;

  const completeVerification = async () => {
    const result: IDKitResult = {
      responses: [{ nullifier: "e2e-world-id-nullifier" }],
    };

    try {
      await handleVerify(result);
      await onSuccess(result);
      if (autoClose) onOpenChange(false);
    } catch (error) {
      onError(error);
    }
  };

  return (
    <div role="dialog" aria-label="World ID test verifier">
      <button type="button" onClick={() => void completeVerification()}>
        Complete test World ID verification
      </button>
    </div>
  );
}
