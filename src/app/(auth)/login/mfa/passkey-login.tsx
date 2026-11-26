"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { passkeyLoginOptions, passkeyLoginVerify } from "../../mfa-actions";

export function PasskeyLoginButton({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const options = await passkeyLoginOptions();
            if (!options) throw new Error("Für diese Adresse ist kein Passkey hinterlegt.");
            const response = await startAuthentication({ optionsJSON: options });
            const result = await passkeyLoginVerify(response, next);
            if (result?.error) setError(result.error);
          } catch (e) {
            // NotAllowedError = user cancelled the browser dialog
            setError(e instanceof Error && e.name === "NotAllowedError" ? "Abgebrochen." : e instanceof Error ? e.message : "Passkey fehlgeschlagen.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <KeyRound className="size-4" /> {busy ? "Warte auf Passkey …" : "Mit Passkey bestätigen"}
      </Button>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
