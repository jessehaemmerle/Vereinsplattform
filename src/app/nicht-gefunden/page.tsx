import { rootUrl } from "@/lib/hosts";

export const metadata = { title: "Nicht gefunden" };

export default function UnknownHost() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-loden text-6xl font-semibold">404</p>
      <h1 className="mt-4 text-xl font-semibold">Unter dieser Adresse gibt es keinen Verein.</h1>
      <p className="text-muted mt-2">Prüfe die Schreibweise oder suche deinen Verein auf der Startseite.</p>
      <a href={rootUrl()} className="text-loden mt-6 underline-offset-4 hover:underline">
        Zur Startseite
      </a>
    </main>
  );
}
