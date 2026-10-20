"use client";

import { useState, type ReactNode } from "react";
import type { EmailTemplate } from "@prisma/client";
import { ActionForm, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

export function MessageForm({
  action,
  templates,
  cancelHref,
  children,
  defaults,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  templates: Pick<EmailTemplate, "id" | "name" | "subject" | "body">[];
  cancelHref: string;
  children?: ReactNode;
  defaults?: { subject?: string; body?: string };
}) {
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState(defaults?.body ?? "");
  return (
    <ActionForm action={action} className="max-w-3xl">
      {children}
      {templates.length > 0 && (
        <Select
          label="Vorlage"
          name="_template"
          defaultValue=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) {
              setSubject(t.subject);
              setBody(t.body);
            }
          }}
          options={[{ value: "", label: "Ohne Vorlage" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
        />
      )}
      <Input label="Betreff" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <Textarea
        label="Nachricht"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={12}
        required
        hint="Platzhalter: {{vorname}}, {{nachname}}, {{verein}} – werden für jede Person ersetzt."
      />
      <div className="flex gap-3">
        <SubmitButton pendingText="Wird gesendet …">Senden</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
