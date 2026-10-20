"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Da ist etwas schiefgelaufen.</h1>
      <p className="text-muted mt-2">Der Fehler wurde protokolliert. Lade die Seite neu oder versuche es später nochmal.</p>
      <button onClick={reset} className="bg-loden mt-6 rounded-md px-4 py-2 text-white">
        Erneut versuchen
      </button>
    </main>
  );
}
