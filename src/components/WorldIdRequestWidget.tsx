import React from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";

interface WorldIdRequestWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  action: string;
  rpContext: RpContext;
  handleVerify: (result: IDKitResult) => Promise<void>;
  onSuccess: (result: IDKitResult) => Promise<void> | void;
  onError: (errorCode: unknown) => void;
}

const WorldIdRequestWidget: React.FC<WorldIdRequestWidgetProps> = ({
  open,
  onOpenChange,
  appId,
  action,
  rpContext,
  handleVerify,
  onSuccess,
  onError,
}) => {
  return (
    <IDKitRequestWidget
      open={open}
      onOpenChange={onOpenChange}
      app_id={appId}
      action={action}
      rp_context={rpContext}
      allow_legacy_proofs={true}
      preset={orbLegacy({})}
      handleVerify={handleVerify}
      onSuccess={onSuccess}
      onError={onError}
      autoClose
    />
  );
};

export default WorldIdRequestWidget;
