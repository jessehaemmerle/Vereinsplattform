import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-loden text-6xl font-semibold">404</p>
      <h1 className="mt-4 text-xl font-semibold">Diese Seite gibt es nicht – oder du hast keinen Zugriff darauf.</h1>
      <Link href="/" className="text-loden mt-6 underline-offset-4 hover:underline">
        Zur Startseite
      </Link>
    </main>
  );
}
