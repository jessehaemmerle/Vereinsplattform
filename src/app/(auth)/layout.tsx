export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-rail text-rail-ink relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <span className="text-lg font-semibold">Vereinsplattform</span>
        <div>
          <p className="max-w-sm text-[40px] leading-[1.1] font-semibold tracking-[-0.02em]">Mitglieder, Kassa und Termine – ohne Zettelwirtschaft.</p>
          <p className="text-rail-ink/70 mt-6 max-w-sm">
            Für Obleute, Kassiere und Schriftführer, die ihre Vereinsarbeit am Abend erledigen und nicht am Wochenende.
          </p>
        </div>
        <svg aria-hidden className="text-rail-ink/[0.06] absolute -right-24 -bottom-24 size-[420px]" viewBox="0 0 100 100">
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx="50" cy="50" r={8 + i * 6} fill="none" stroke="currentColor" strokeWidth="1.2" />
          ))}
        </svg>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
