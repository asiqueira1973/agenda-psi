import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { erros, mensagensDoApp, sucesso } from '../../src/rules/messages.js';

const validacaoDoApp = readFileSync(new URL('../../../app/src/lib/validation.ts', import.meta.url), 'utf8');

describe('mensagens', () => {
  it('as mensagens copiadas do app são idênticas às de app/src/lib/validation.ts', () => {
    for (const [chave, texto] of Object.entries(mensagensDoApp)) {
      expect(validacaoDoApp).toContain(`${chave}: '${texto}'`);
    }
  });

  it('nenhum texto tem exclamação ou emoji (seção 15)', () => {
    const todos = [...Object.values(mensagensDoApp), ...Object.values(sucesso), ...Object.values(erros)];
    for (const t of todos) {
      expect(t).not.toMatch(/!/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
