"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { sendTestMail } from "../actions";

export function MailTest() {
  return (
    <ActionForm action={async () => sendTestMail()}>
      <SubmitButton pendingText="Wird geprüft …">Test-E-Mail an mich senden</SubmitButton>
    </ActionForm>
  );
}
