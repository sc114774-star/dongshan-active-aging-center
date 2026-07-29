import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-notebook">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 md:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
