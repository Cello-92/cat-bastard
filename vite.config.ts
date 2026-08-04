import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  // Path relativi: il gioco deve funzionare sia in locale sia sotto
  // https://<user>.github.io/cat-bastard/ senza cambiare configurazione.
  base: './',
  resolve: {
    alias: {
      '@core': src('core'),
      '@engine': src('engine'),
      '@game': src('game'),
      '@ui': src('ui'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    open: true,
  },
});
