import vinext from "vinext";
import { defineConfig } from "vite";

// vinext forces `noExternal: true` in the server environments, which routes every
// dependency through Vite's transform pipeline. The native MongoDB driver (and
// mongoose, which wraps it) rely on CommonJS internals that don't survive that
// transform, so we externalize them and let Node load them directly.
const serverExternals = ["mongodb", "mongoose"];

export default defineConfig({
  plugins: [vinext()],
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
