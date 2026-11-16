import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { despesaDoApp, doAgente, doSpec, horarioDoApp, pacienteDoApp, pagamentoDoApp, sessaoDoApp, textosNovosEpico6 } from '../../src/rules/copy-registros.js';

const ler = (c: string) => readFileSync(new URL(`../../../app/${c}`, import.meta.url), 'utf8');
const spec = readFileSync(new URL('../../spec.md', import.meta.url), 'utf8');
const textos = (b: Record<string, unknown>) => Object.entries(b).filter((e): e is [string, string] => typeof e[1] === 'string');

describe('copy do épico 6 igual à do app (15)', () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ['src/features/sessions/copy.ts', sessaoDoApp],
    ['src/features/sessions/copy.ts', pagamentoDoApp],
    ['src/features/expenses/copy.ts', despesaDoApp],
    ['src/features/schedule/copy.ts', horarioDoApp],
    ['src/features/patients/copy.ts', pacienteDoApp],
  ];
  for (const [arquivo, bloco] of casos) {
    it(arquivo, () => {
      const app = ler(arquivo).replace(/\n\s+/g, ' ');
      for (const [, t] of textos(bloco)) expect(app, t).toContain(`'${t}'`);
    });
  }
  it('sucessos do paciente com interpolação', () => {
    const p = ler('src/features/patients/copy.ts');
    expect(p).toContain('sucessoAtualizado: (nome: string) => `${nome} atualizado.`');
    expect(p).toContain('sucessoPreco: (valor: string) => `Novo preço de ${valor} vigente a partir de hoje.`');
    expect(pacienteDoApp.sucessoPreco('R$ 300')).toBe('Novo preço de R$ 300 vigente a partir de hoje.');
  });
  it('textos do cartão do agente', () => {
    const a = ler('src/features/agent/copy.ts');
    for (const [, t] of textos(doAgente)) expect(a, t).toContain(`'${t}'`);
    expect(a).toContain('antes: (valor: string) => `Antes: ${valor}`');
  });
  it('textos do spec', () => {
    expect(spec).toContain('"Excluir definitivamente"');
    expect(spec).toContain('"Horário alterado"');
  });
  it('sem exclamação nem emoji', () => {
    const todos = [sessaoDoApp, pagamentoDoApp, despesaDoApp, horarioDoApp, pacienteDoApp, doAgente, doSpec, textosNovosEpico6].flatMap((b) => textos(b).map(([, t]) => t));
    for (const t of todos) expect(t).not.toMatch(/!|\p{Extended_Pictographic}/u);
  });
});
