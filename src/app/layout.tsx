import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

// Campus type system: one sans family (Public Sans) carries both body and
// display, with heavy 800/900 weights for headings. IBM Plex Mono covers
// times, course codes and room numbers. CJK uses installed system fonts
// (PingFang HK / Microsoft JhengHei / local Noto) — self-hosting Noto Sans HK
// through next/font emits ~100 unicode-range woff2 files, which abort behind
// HTTP/1.1 reverse proxies and take down the page JS with them.
const publicSans = Public_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800", "900"],
	variable: "--font-public-sans",
	display: "swap",
});
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
      className={`${publicSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
