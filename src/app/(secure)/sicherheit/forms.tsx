"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  confirmTotpSetup,
  deletePasskey,
  disableTotp,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  regenerateRecoveryCodes,
  startTotpSetup,
  type SecurityState,
} from "./actions";

const input = "border-line bg-surface focus:border-loden focus:ring-loden/20 w-full rounded-md border px-3 py-2 text-[15px] focus:ring-2 focus:outline-none";

/** After a factor was added: codes stay visible until the user confirms, then the page reloads its state. */
function Done() {
  const router = useRouter();
  return (
    <Button type="button" onClick={() => router.refresh()}>
      Fertig
    </Button>
  );
}

function Messages({ state }: { state: SecurityState }) {
  if (!state) return null;
  return (
    <>
      {state.error && (
        <p role="alert" className="border-danger/40 bg-danger-soft text-danger rounded-md border px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="border-ok/30 bg-ok-soft text-ok rounded-md border px-3 py-2 text-sm">
          {state.ok}
        </p>
      )}
      {state.codes && <RecoveryCodes codes={state.codes} />}
    </>
  );
}

/** Shown once after creation – only hashes are stored. */
function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  return (
    <div className="border-brass/40 bg-brass-soft space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Deine Wiederherstellungscodes – jetzt sicher aufbewahren, sie werden nur einmal angezeigt:</p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm whitespace-nowrap sm:grid-cols-3 xl:grid-cols-5" aria-label="Wiederherstellungscodes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(text)}>
          <Copy className="size-4" /> Kopieren
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Wiederherstellungscodes\n\n${text}\n`)}`}
          download="wiederherstellungscodes.txt"
          className="border-line bg-surface hover:border-loden inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm"
        >
          <Download className="size-4" /> Als Datei speichern
        </a>
      </div>
    </div>
  );
}

export function TotpSetup() {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [pending, start] = useTransition();
  const [state, action, confirming] = useActionState(confirmTotpSetup, undefined);
  if (state?.ok)
    return (
      <div className="space-y-3">
        <Messages state={state} />
        <Done />
      </div>
    );
  if (!setup)
    return (
      <Button type="button" disabled={pending} onClick={() => start(async () => setSetup(await startTotpSetup()))}>
        Authenticator-App einrichten
      </Button>
    );
  return (
    <form action={action} className="space-y-4">
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>
          QR-Code mit der App scannen:
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR-Code für die Authenticator-App" className="mt-2 size-44 rounded bg-white p-1" />
          <details className="mt-2">
            <summary className="text-loden cursor-pointer">Kein Scan möglich? Schlüssel manuell eingeben</summary>
            <code className="bg-paper mt-1 block rounded p-2 text-xs break-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
          </details>
        </li>
        <li>
          Den 6-stelligen Code aus der App eingeben:
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{3}\s?\d{3}"
            aria-label="Code aus der App"
            className={`${input} mt-2 max-w-40 font-mono`}
          />
        </li>
      </ol>
      <Messages state={state} />
      <Button disabled={confirming}>{confirming ? "Wird geprüft …" : "Bestätigen und aktivieren"}</Button>
    </form>
  );
}

function PasswordConfirm({
  action,
  label,
  danger,
  hidden,
}: {
  action: (s: SecurityState, f: FormData) => Promise<SecurityState>;
  label: string;
  danger?: boolean;
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  if (!open && !state?.codes)
    return (
      <Button type="button" size="sm" variant={danger ? "danger" : "secondary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  return (
    <form action={formAction} className="w-full space-y-3">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {!state?.codes && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-sm">
            Zur Bestätigung dein Passwort
            <input type="password" name="password" required autoComplete="current-password" className={`${input} mt-1`} autoFocus />
          </label>
          <Button size="sm" variant={danger ? "danger" : "primary"} disabled={pending}>
            {label}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
        </div>
      )}
      <Messages state={state} />
    </form>
  );
}

export function DisableTotpForm() {
  return <PasswordConfirm action={disableTotp} label="App entfernen" danger />;
}

export function DeletePasskeyForm({ id, name }: { id: string; name: string }) {
  return <PasswordConfirm action={deletePasskey} label={`„${name}“ entfernen`} danger hidden={{ id }} />;
}

export function RecoveryCodesForm() {
  return <PasswordConfirm action={regenerateRecoveryCodes} label="Neue Codes erzeugen" />;
}

export function PasskeySetup() {
  const [name, setName] = useState("");
  const [state, setState] = useState<SecurityState>(undefined);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-sm">
          Bezeichnung
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. iPhone, YubiKey" maxLength={60} className={`${input} mt-1`} />
        </label>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setState(undefined);
            try {
              const options = await passkeyRegisterOptions();
              if (!options) throw new Error("Bitte melde dich erneut an.");
              const response = await startRegistration({ optionsJSON: options });
              setState(await passkeyRegisterVerify(response, name));
              setName("");
            } catch (e) {
              const msg =
                e instanceof Error && e.name === "NotAllowedError"
                  ? "Abgebrochen."
                  : e instanceof Error && e.name === "InvalidStateError"
                    ? "Dieses Gerät ist bereits registriert."
                    : "Passkey konnte nicht erstellt werden.";
              setState({ error: msg });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Warte auf Gerät …" : "Passkey hinzufügen"}
        </Button>
      </div>
      <Messages state={state} />
      {state?.ok && <Done />}
    </div>
  );
}
