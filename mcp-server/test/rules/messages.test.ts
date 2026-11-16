import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  copyDespesaDoApp,
  erros,
  mensagensDoApp,
  sucesso,
  textosNovosDespesa,
  textosParaOModelo,
} from '../../src/rules/messages.js';

const ler = (caminho: string) => readFileSync(new URL(`../../../app/${caminho}`, import.meta.url), 'utf8');
const validacaoDoApp = ler('src/lib/validation.ts');
const copyDespesasDoApp = ler('src/features/expenses/copy.ts');

describe('mensagens', () => {
  it('as mensagens copiadas do app são idênticas às de app/src/lib/validation.ts', () => {
    for (const [chave, texto] of Object.entries(mensagensDoApp)) {
      expect(validacaoDoApp).toContain(`${chave}: '${texto}'`);
    }
  });

  it('a copy da despesa é idêntica à de app/src/features/expenses/copy.ts', () => {
    for (const [chave, texto] of Object.entries(copyDespesaDoApp)) {
      expect(copyDespesasDoApp).toContain(`${chave}: '${texto}'`);
    }
  });

  it('nenhum texto tem exclamação ou emoji (seção 15)', () => {
    const todos = [
      ...Object.values(mensagensDoApp),
      ...Object.values(copyDespesaDoApp),
      ...Object.values(textosNovosDespesa),
      ...Object.values(sucesso),
      ...Object.values(erros),
      ...Object.values(textosParaOModelo).map((t) => (typeof t === 'function' ? t('aluguel', 2) : t)),
    ];
    for (const t of todos) {
      expect(t).not.toMatch(/!/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
