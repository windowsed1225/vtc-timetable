"use client";

import { useRouter } from "@/lib/navigation";
import { signIn } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
    const router = useRouter();
    const t = useTranslations("auth");
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleDiscordSignIn = async () => {
        setIsLoading(true);
        await signIn.social({ provider: "discord", callbackURL: "/" });
    };

    const handleCredentialsSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const { error: signInError } = await signIn.email({ email, password });

            if (signInError) {
                setError(t("invalidCredentials"));
                setIsLoading(false);
            } else {
                router.push("/");
                router.refresh();
                onClose();
            }
        } catch {
            setError(t("genericError"));
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn px-4">
            <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-black p-8 animate-scaleIn">
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute right-4 top-4 rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="mb-6 pr-8">
                    <h2 className="text-2xl font-bold tracking-tight text-white">{t("welcomeBack")}</h2>
                    <p className="mt-2 text-sm text-zinc-400">{t("signInSubtitle")}</p>
                </div>

                <button
                    onClick={handleDiscordSignIn}
                    disabled={isLoading}
                    className="mb-6 flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    {isLoading ? t("signingIn") : t("continueWithDiscord")}
                </button>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-800"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-[0.12em]">
                        <span className="bg-black px-2 text-zinc-500">{t("orContinueWith")}</span>
                    </div>
                </div>

                <form onSubmit={handleCredentialsSignIn} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">{t("email")}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            disabled={isLoading}
                            className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2.5 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">{t("password")}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("passwordPlaceholder")}
                            required
                            disabled={isLoading}
                            className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2.5 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500"
                        />
                    </div>

                    {error && (
                        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? t("signingIn") : t("signInBtn")}
                    </button>
                </form>

                <p className="mt-5 text-center text-xs text-zinc-500">{t("noPasswordHint")}</p>
            </div>
        </div>
    );
}
