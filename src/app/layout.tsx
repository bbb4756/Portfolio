import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { getSettings } from "@/lib/content";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return { title: settings.seoTitle, description: settings.seoDescription };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
      <Script src="/vendor/mermaid.min.js" strategy="lazyOnload" />
    </html>
  );
}
