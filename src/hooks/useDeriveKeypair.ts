import { useCallback, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { KEYPAIR_VERSION } from "@/services/eddsaService";
import type { StoredKeypair } from "@/types/keypair";
import type { DerivedKeypair } from "@/services/deterministicKeyService";

export interface DeriveKeypairResult {
  derivedKeypair: DerivedKeypair;
  publicKey: { x: string; y: string };
  storedKeypair: StoredKeypair;
}

function toStoredKeypair(keypair: DerivedKeypair): StoredKeypair {
  return {
    version: KEYPAIR_VERSION,
    seed: keypair.seedHex,
    k: keypair.sk.toString(),
    Ax: keypair.pk.x.toString(),
    Ay: keypair.pk.y.toString(),
  };
}

/**
 * Shared passkey -> keypair derivation flow used by the dashboard and the
 * election detail page. Authenticates with the preferred passkey, derives and
 * verifies the BabyJubJub keypair, publishes the public key to wallet context,
 * and surfaces success/failure as a toast. Returns null on failure.
 *
 * @param options.store  also persist the keypair to sessionStorage
 *                        (election detail needs it for signing; the dashboard
 *                        just displays the public key).
 */
export function useDeriveKeypair() {
  const { setDerivedPublicKey } = useWallet();
  const { toast } = useToast();
  const [isDeriving, setIsDeriving] = useState(false);

  const deriveKeypair = useCallback(
    async (options: { store?: boolean } = {}): Promise<DeriveKeypairResult | null> => {
      setIsDeriving(true);
      try {
        const [
          { authenticateWithPreferredPasskey },
          { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair },
        ] = await Promise.all([
          import("@/services/passkeyService"),
          import("@/services/deterministicKeyService"),
        ]);

        const prfResult = await authenticateWithPreferredPasskey();
        const derivedKeypair = await deriveKeypairFromSecret(prfResult.secret);

        if (!verifyDerivedKeypair(derivedKeypair)) {
          throw new Error("Derived keypair verification failed");
        }

        const publicKey = publicKeyToStrings(derivedKeypair.pk);
        setDerivedPublicKey(publicKey);

        const storedKeypair = toStoredKeypair(derivedKeypair);
        if (options.store) {
          const { storeKeypair } = await import("@/services/keypairService");
          storeKeypair(storedKeypair);
        }

        toast({
          title: "Passkey unlocked",
          description: "Your signing key has been re-derived locally and is ready for use.",
        });

        return { derivedKeypair, publicKey, storedKeypair };
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Derivation failed",
          description:
            error instanceof Error ? error.message : "Failed to derive keypair",
        });
        return null;
      } finally {
        setIsDeriving(false);
      }
    },
    [setDerivedPublicKey, toast]
  );

  return { deriveKeypair, isDeriving };
}
