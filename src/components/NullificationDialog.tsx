
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, X } from "lucide-react";

interface NullificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActualNullification: () => void;
  onDummyNullification: () => void;
  isProcessing: boolean;
}

const NullificationDialog: React.FC<NullificationDialogProps> = ({
  open,
  onOpenChange,
  onActualNullification,
  onDummyNullification,
  isProcessing,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Nullification Options
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose the type of nullification you want to submit:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-destructive" />
              <h3 className="font-medium">Actual Nullification</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This will encrypt your actual vote nullification (value = 1) and generate a ZK proof showing you know your private key.
            </p>
          </div>
          
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <h3 className="font-medium">Dummy Nullification</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This will encrypt a dummy value (value = 0) and generate a ZK proof for privacy protection without revealing your actual vote.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onDummyNullification}
            disabled={isProcessing}
            size="sm"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
          >
            <Shield className="mr-2 h-4 w-4" />
            Dummy
          </Button>
          <Button
            variant="destructive"
            onClick={onActualNullification}
            disabled={isProcessing}
            size="sm"
          >
            <X className="mr-2 h-4 w-4" />
            Actual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NullificationDialog;
