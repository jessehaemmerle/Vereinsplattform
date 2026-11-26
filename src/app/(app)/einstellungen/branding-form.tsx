"use client";

import { useMemo, useState } from "react";
import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { buildTheme, HEX_PATTERN } from "@/lib/color";
import { FONT_OPTIONS } from "@/lib/font-options";
import { updateBranding } from "./actions";

type Branding = {
  name: string;
  primaryColor: string;
  accentColor: string;
  fontKey: string;
  loginTitle: string;
  loginText: string;
  emailSenderName: string;
  emailFooter: string;
  images: Record<"logo" | "logoDark" | "favicon" | "loginImage", string | null>;
};

function ColorField({ label, name, value, onChange, hint }: { label: string; name: string; value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} wählen`}
          value={HEX_PATTERN.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="border-line h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="#[0-9a-fA-F]{6}"
          className="border-line bg-surface focus:border-loden w-32 rounded-md border px-3 font-mono text-sm focus:outline-none"
        />
      </div>
      <p className="text-muted text-sm">{hint}</p>
    </div>
  );
}

function ImageField({ label, name, current, hint, accept }: { label: string; name: string; current: string | null; hint: string; accept: string }) {
  return (
    <div className="border-line space-y-2 rounded-md border p-4">
      <p className="text-sm font-medium">{label}</p>
      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className="border-line h-14 max-w-full rounded border bg-white object-contain p-1" />
      )}
      <input
        type="file"
        name={name}
        accept={accept}
        aria-label={label}
        className="file:bg-loden-soft file:text-loden block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
      />
      <p className="text-muted text-xs">{hint}</p>
      {current && <Checkbox name={`${name}Remove`} label="Entfernen" />}
    </div>
  );
}

/** Live preview of the derived palette – the same function the server uses, so what you see is what members get. */
function Preview({ name, primary, accent, fontKey }: { name: string; primary: string; accent: string; fontKey: string }) {
  const theme = useMemo(() => buildTheme(primary, accent), [primary, accent]);
  const t = theme.light;
  const font = `var(${FONT_OPTIONS[fontKey as keyof typeof FONT_OPTIONS]?.cssVar ?? "--font-schibsted"})`;
  return (
    <div className="space-y-3">
      <div className="border-line overflow-hidden rounded-lg border" style={{ fontFamily: font }} aria-label="Vorschau">
        <div className="flex">
          <div className="w-32 shrink-0 space-y-2 p-3 text-xs" style={{ background: t["--rail"], color: t["--rail-ink"] }}>
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="rounded px-2 py-1" style={{ background: "rgba(255,255,255,.12)" }}>
              Übersicht
            </p>
            <p className="px-2 opacity-75">Mitglieder</p>
            <p className="px-2 opacity-75">Finanzen</p>
          </div>
          <div className="flex-1 space-y-3 p-4" style={{ background: t["--paper"], color: "#18211c" }}>
            <p className="text-lg font-semibold">Servus!</p>
            <div className="rounded-md p-3 text-white" style={{ background: t["--loden"] }}>
              <p className="text-xs opacity-80">Kassastand</p>
              <p className="text-xl font-semibold">€ 4.344,10</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded px-3 py-1.5 font-medium text-white" style={{ background: t["--loden"] }}>
                Speichern
              </span>
              <span className="rounded px-2 py-0.5" style={{ background: t["--loden-soft"], color: t["--loden"] }}>
                aktiv
              </span>
              <span className="rounded px-2 py-0.5" style={{ background: t["--brass-soft"], color: t["--brass"] }}>
                Beitrag offen
              </span>
            </div>
          </div>
        </div>
      </div>
      {theme.warnings.map((w) => (
        <p key={w} className="border-brass/40 bg-brass-soft rounded-md border px-3 py-2 text-xs">
          {w}
        </p>
      ))}
    </div>
  );
}

export function BrandingForm({ branding }: { branding: Branding }) {
  const [primary, setPrimary] = useState(branding.primaryColor);
  const [accent, setAccent] = useState(branding.accentColor);
  const [fontKey, setFontKey] = useState(branding.fontKey);
  return (
    <ActionForm action={updateBranding}>
      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <fieldset className="space-y-5">
            <legend className="mb-3 font-semibold">Farben und Schrift</legend>
            <FormGrid>
              <ColorField label="Hauptfarbe" name="primaryColor" value={primary} onChange={setPrimary} hint="Seitenleiste, Schaltflächen, Kassastand" />
              <ColorField label="Akzentfarbe" name="accentColor" value={accent} onChange={setAccent} hint="Hinweise, offene Beiträge, Markierungen" />
            </FormGrid>
            <Select
              label="Schrift"
              name="fontKey"
              value={fontKey}
              onChange={(e) => setFontKey(e.target.value)}
              options={Object.entries(FONT_OPTIONS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </fieldset>
          <fieldset className="border-line space-y-4 border-t pt-6">
            <legend className="mb-3 font-semibold">Logo und Symbol</legend>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <ImageField
                label="Logo"
                name="logo"
                current={branding.images.logo}
                accept="image/png,image/jpeg"
                hint="PNG oder JPG, max. 2 MB. Erscheint auch in E-Mails und PDFs."
              />
              <ImageField
                label="Logo für dunkle Darstellung"
                name="logoDark"
                current={branding.images.logoDark}
                accept="image/png,image/jpeg"
                hint="Optional, z. B. eine helle Variante"
              />
              <ImageField
                label="Browser-Symbol"
                name="favicon"
                current={branding.images.favicon}
                accept="image/png,image/x-icon,.ico"
                hint="Quadratisch, PNG oder ICO. Ohne eigenes Symbol wird das Logo verwendet."
              />
            </div>
          </fieldset>
          <fieldset className="border-line space-y-5 border-t pt-6">
            <legend className="mb-3 font-semibold">Anmeldeseite</legend>
            <Input label="Überschrift" name="loginTitle" defaultValue={branding.loginTitle} placeholder={branding.name} />
            <Textarea
              label="Begrüßungstext"
              name="loginText"
              defaultValue={branding.loginText}
              rows={3}
              placeholder="z. B. Willkommen im Mitgliederbereich. Hier findest du Termine, Beiträge und Dokumente."
            />
            <ImageField
              label="Hintergrundbild"
              name="loginImage"
              current={branding.images.loginImage}
              accept="image/jpeg,image/png,image/webp"
              hint="Querformat, JPG/PNG/WebP, max. 5 MB. Wird in der Hauptfarbe abgedunkelt."
            />
          </fieldset>
          <fieldset className="border-line space-y-5 border-t pt-6">
            <legend className="mb-3 font-semibold">E-Mails</legend>
            <Input
              label="Absendername"
              name="emailSenderName"
              defaultValue={branding.emailSenderName}
              placeholder={branding.name}
              hint="Die Absenderadresse bleibt die der Plattform, damit E-Mails nicht im Spam landen."
            />
            <Textarea
              label="Fußzeile"
              name="emailFooter"
              defaultValue={branding.emailFooter}
              rows={3}
              placeholder={`${branding.name} · Straße 1 · PLZ Ort\nZVR-Zahl`}
            />
          </fieldset>
        </div>
        <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <p className="text-sm font-medium">Vorschau</p>
          <Preview name={branding.name} primary={primary} accent={accent} fontKey={fontKey} />
          <p className="text-muted text-xs">
            Zu helle Farben werden automatisch so angepasst, dass Text gut lesbar bleibt (WCAG AA). Den Dunkelmodus leiten wir aus denselben Farben ab.
          </p>
        </div>
      </div>
      <div className="border-line mt-8 border-t pt-5">
        <SubmitButton pendingText="Wird gespeichert …">Erscheinungsbild speichern</SubmitButton>
      </div>
    </ActionForm>
  );
}
