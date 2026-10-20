import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { toDateTimeInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { EventForm } from "../event-form";
import { deleteEvent, saveEvent } from "../actions";

export const metadata = { title: "Termin bearbeiten" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("events:write", "EVENTS");
  const { id } = await params;
  const event = await db.event.findFirst({ where: { id, clubId: user.clubId } });
  if (!event) notFound();
  return (
    <>
      <PageHeader
        title="Termin bearbeiten"
        actions={
          <ActionButton
            action={deleteEvent}
            fields={{ id: event.id }}
            variant="danger"
            size="md"
            confirm="Termin löschen? Eine Kostenbuchung bleibt in den Finanzen erhalten."
          >
            Löschen
          </ActionButton>
        }
      />
      <EventForm
        action={saveEvent.bind(null, event.id)}
        event={{
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: toDateTimeInput(event.startsAt),
          endsAt: toDateTimeInput(event.endsAt),
          cost: event.cost ? event.cost.toFixed(2).replace(".", ",") : "",
          public: event.public,
        }}
      />
    </>
  );
}
