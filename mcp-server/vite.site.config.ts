import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Build das páginas do domínio (6.3): `/` e `/oauth/consent`, em `public/`, que a
 * Vercel serve como estático (vercel.json). A URL e a chave PUBLICÁVEL do Supabase
 * entram no build a partir do ambiente; nenhuma chave secreta existe aqui (P1, 6.3).
 * Falha se faltar alguma, para não publicar uma página que não loga.
 */
const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !chave) throw new Error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY para montar o site.');
if (!chave.startsWith('sb_publishable_')) throw new Error('SUPABASE_PUBLISHABLE_KEY precisa ser a chave publicável.');

export default defineConfig({
  root: 'site',
  define: {
    __SUPABASE_URL__: JSON.stringify(url),
    __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(chave),
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        inicio: resolve(import.meta.dirname, 'site/index.html'),
        consentimento: resolve(import.meta.dirname, 'site/oauth/consent/index.html'),
      },
    },
  },
  logLevel: 'warn',
});
