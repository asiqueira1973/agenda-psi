import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

/**
 * Monta os formulários (4.2): cada `ui/<form>/index.html` vira um HTML único (Vite +
 * singlefile, vite.config.ts) e é embutido em src/ui/generated.ts, que fica fora do git.
 * Falha se algum passar de 300 KB (17; teto alterado em 15/11/2026).
 */
const FORMULARIOS = ['expense', 'sessions', 'payment', 'patient', 'schedule', 'feedback'];
const LIMITE_BYTES = 300 * 1024;

const html: Record<string, string> = {};
for (const form of FORMULARIOS) {
  if (!existsSync(`ui/${form}/index.html`)) continue;
  process.env.FORM = form;
  await build({ configFile: 'vite.config.ts', logLevel: 'warn' });
  const texto = readFileSync(`ui/dist/${form}/index.html`, 'utf8');
  const bytes = Buffer.byteLength(texto);
  if (bytes > LIMITE_BYTES) {
    console.error(`ui/${form}: ${bytes} bytes, acima do limite de ${LIMITE_BYTES} (seção 17).`);
    process.exit(1);
  }
  console.log(`ui/${form}: ${(bytes / 1024).toFixed(1)} KB`);
  html[form] = texto;
}

const linhas = [
  '// GERADO por scripts/build-ui.ts a partir de ui/. Não edite.',
  `export const FORMULARIOS_HTML: Record<string, string> = ${JSON.stringify(html)};`,
  `export const DESPESA_HTML: string = FORMULARIOS_HTML.expense ?? '';`,
];
mkdirSync('src/ui', { recursive: true });
writeFileSync('src/ui/generated.ts', `${linhas.join('\n')}\n`);
