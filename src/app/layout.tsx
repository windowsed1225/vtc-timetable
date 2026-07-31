import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Noto_Sans_HK, Public_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

// HK transit type system: Archivo = display/signage, Public Sans = body,
// IBM Plex Mono = times/room numbers, Noto Sans HK = CJK fallback.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});
const notoSansHK = Noto_Sans_HK({ subsets: ["latin"], variable: "--font-noto-hk", preload: false });

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
      className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} ${notoSansHK.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
