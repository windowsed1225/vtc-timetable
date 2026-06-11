import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "VTC Calendar | Class Schedule",
  description:
    "View your VTC class schedule on a beautiful calendar and export it to your favorite calendar app.",
  icons: {
    icon: [{ url: "/vtctimetable.svg", type: "image/svg+xml", sizes: "any" }],
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
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
