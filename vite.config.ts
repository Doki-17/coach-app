import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite only exposes VITE_-prefixed env vars to client code by default.
// Our Supabase vars are named SUPABASE_URL / SUPABASE_PUBLISH_KEY (no VITE_
// prefix, to match how they're set in Vercel), so we explicitly wire just
// those two into import.meta.env at build time.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'import.meta.env.SUPABASE_PUBLISH_KEY': JSON.stringify(env.SUPABASE_PUBLISH_KEY),
    },
  }
})
