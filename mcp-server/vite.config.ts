import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Build de UM formulário (4.1 e 4.2): HTML, CSS e JS num arquivo só, que o servidor
 * embute como string. Qual formulário vem de `FORM` (ex.: `FORM=expense`). A saída fica
 * em `ui/dist/<form>/index.html`; scripts/embed-ui.ts gera src/ui/generated.ts a partir dela.
 */
const FORM = process.env.FORM;
if (!FORM) throw new Error('Defina FORM, por exemplo FORM=expense.');

export default defineConfig({
  root: `ui/${FORM}`,
  plugins: [viteSingleFile()],
  build: {
    outDir: `../dist/${FORM}`,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'ui', FORM, 'index.html') },
  },
  logLevel: 'warn',
});
