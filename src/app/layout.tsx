import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

// HK transit type system: Archivo = display/signage, Public Sans = body,
// IBM Plex Mono = times/room numbers. CJK uses installed system fonts
// (PingFang HK / Microsoft JhengHei / local Noto) — self-hosting Noto Sans HK
// through next/font emits ~100 unicode-range woff2 files, which abort behind
// HTTP/1.1 reverse proxies and take down the page JS with them.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VTC Calendar | Class Schedule",
  description:
    "View your VTC class schedule on a beautiful calendar and export it to your favorite calendar app.",
  icons: {
    icon: [{ url: "/vtc-timetable.svg", type: "image/svg+xml", sizes: "any" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Root layout — owns <html> and <body> as required by Next.js 16.
// Uses getLocale() from next-intl/server to set the correct lang attribute.
// [locale]/layout.tsx provides NextIntlClientProvider and Providers (no html/body).
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
