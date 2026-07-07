import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa bibliotecas grandes e independentes em chunks próprios e
        // estáveis, mantendo-as em cache entre deploys.
        // IMPORTANTE: React e recharts NÃO são separados manualmente — deixamos
        // o Rollup posicioná-los automaticamente. Forçar a separação do React
        // quebra a ordem de inicialização de libs acopladas a ele (recharts),
        // causando "Cannot access 'X' before initialization" (TDZ).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tanstack")) return "vendor-query";
        },
      },
    },
  },
}));
