import Providers from "@/components/Providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VTC Calendar | Class Schedule",
  description:
    "View your VTC class schedule on a beautiful calendar and export it to your favorite calendar app.",
  icons: {
    icon: [
      {
        url: '/vtctimetable.svg', // Reference from the public directory
        href: '/vtctimetable.svg',
        type: 'image/svg+xml',
        sizes: 'any', // Best practice for SVG icons
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
