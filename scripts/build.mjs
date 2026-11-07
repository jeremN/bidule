// Builds every page as a self-contained HTML file (JS + CSS inlined) into dist/.
// Each file runs on its own: open it, host it, or publish it anywhere.
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pages = ['index', 'chantier', 'ferme'];
for (const [i, page] of pages.entries()) {
  await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [viteSingleFile()],
    build: { outDir: 'dist', emptyOutDir: i === 0, rollupOptions: { input: `${page}.html` } }
  });
  console.log(`✓ dist/${page}.html`);
}
