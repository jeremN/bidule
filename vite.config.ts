import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

// GitHub Pages serves the app under /bidule/. Locally it lives at /.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  server: { port: 3000 },
  plugins: [
    tanstackStart({
      router: { basepath: base },
      prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: true, failOnError: true }
    }),
    viteReact()
  ]
});
