import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import vinext from "vinext";
import { defineConfig } from "vite";

// vinext forces `noExternal: true` in the server environments, which routes every
// dependency through Vite's transform pipeline. The native MongoDB driver (and
// mongoose, which wraps it) rely on CommonJS internals that don't survive that
// transform, so we externalize them and let Node load them directly.
const serverExternals = ["mongodb", "mongoose", "redis"];

// Nitro is only needed when building the deploy output (Vercel sets VERCEL=1; or
// pass NITRO_PRESET explicitly). It emits the Build Output API (.vercel/output).
// Local `vinext dev`/`build` skip it so the dev workflow is unchanged.
const deploying = Boolean(process.env.VERCEL || process.env.NITRO_PRESET);

export default defineConfig({
	plugins: [tailwindcss(), vinext(), ...(deploying ? [nitro()] : [])],
	server: {
		host: "0.0.0.0",
		// This app is intentionally reachable through arbitrary LAN and Tailscale
		// IP addresses/hostnames while developing.
		allowedHosts: true,
	},
	ssr: { external: serverExternals },
	// next-intl ships a "use client" component (NextIntlClientProvider) whose React
	// context lives in `use-intl`. plugin-rsc must transform that client boundary
	// itself; if Vite pre-bundles next-intl, the provider and `useTranslations` end
	// up reading different context instances and translations fail with "context was
	// not found". Excluding it from optimizeDeps (per the rsc plugin's own warning)
	// plus deduping keeps a single copy across the client graph.
	resolve: { dedupe: ["next-intl", "use-intl", "react", "react-dom"] },
	optimizeDeps: { exclude: ["next-intl", "use-intl"] },
	environments: {
		rsc: { resolve: { external: serverExternals } },
		ssr: { resolve: { external: serverExternals } },
	},
});
