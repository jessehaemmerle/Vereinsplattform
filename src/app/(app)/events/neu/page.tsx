import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { EventForm } from "../event-form";
import { saveEvent } from "../actions";

export const metadata = { title: "Termin anlegen" };

export default async function NewEventPage() {
  await staff("events:write", "EVENTS");
  return (
    <>
      <PageHeader title="Termin anlegen" />
      <EventForm action={saveEvent.bind(null, null)} />
    </>
  );
}
