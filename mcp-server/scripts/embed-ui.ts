import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Embute os HTMLs dos formulários no servidor como string (4.2), para a função na
 * Vercel não ler disco. Lê `ui/dist/<form>/index.html` e escreve src/ui/generated.ts,
 * que fica fora do git. Falha se algum HTML passar de 300 KB (17; o teto era 150 KB e subiu em 15/11/2026,
 * porque só o `App` do ext-apps ocupa 234 KB).
 */
const LIMITE_BYTES = 300 * 1024;
const FORMULARIOS = { DESPESA_HTML: 'expense' } as const;

const linhas = ['// GERADO por scripts/embed-ui.ts a partir de ui/dist. Não edite.'];
for (const [nome, form] of Object.entries(FORMULARIOS)) {
  const html = readFileSync(`ui/dist/${form}/index.html`, 'utf8');
  const bytes = Buffer.byteLength(html);
  if (bytes > LIMITE_BYTES) {
    console.error(`ui/${form}: ${bytes} bytes, acima do limite de ${LIMITE_BYTES} (seção 17).`);
    process.exit(1);
  }
  console.log(`ui/${form}: ${(bytes / 1024).toFixed(1)} KB`);
  linhas.push(`export const ${nome} = ${JSON.stringify(html)};`);
}
mkdirSync('src/ui', { recursive: true });
writeFileSync('src/ui/generated.ts', `${linhas.join('\n')}\n`);
