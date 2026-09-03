import Providers from "@/components/Providers";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { isLocale } from "../../../i18n/routing";
import "../globals.css";

// [locale] layout — wraps pages with i18n and theme providers.
// Does NOT include <html> or <body> — those are in app/layout.tsx.
export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // The middleware rewrites unprefixed paths onto this segment, so anything
    // else reaching it is a bad internal route rather than a visitor URL.
    if (!isLocale(locale)) {
        notFound();
    }

    // Dynamically import the correct message file based on locale
    const messages = (await import(`../../../messages/${locale}.json`)).default;

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
        </NextIntlClientProvider>
    );
}
