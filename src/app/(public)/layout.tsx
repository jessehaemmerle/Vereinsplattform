import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
