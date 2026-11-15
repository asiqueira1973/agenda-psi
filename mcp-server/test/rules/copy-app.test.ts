import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avisosDePacienteDoApp, copyAgendaDoApp, copyPagamentosDoApp, copySessoesDoApp, mensagensEpico5DoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';

const ler = (c: string) => readFileSync(new URL(`../../../app/${c}`, import.meta.url), 'utf8');

describe('copy do épico 5 igual à do app (15)', () => {
  const casos: Array<[string, Record<string, string>]> = [
    ['src/features/sessions/copy.ts', copySessoesDoApp],
    ['src/features/sessions/copy.ts', copyPagamentosDoApp],
    ['src/features/schedule/copy.ts', copyAgendaDoApp],
    ['src/lib/validation.ts', mensagensEpico5DoApp],
  ];
  for (const [arquivo, bloco] of casos) {
    it(arquivo, () => {
      const app = ler(arquivo);
      for (const [k, t] of Object.entries(bloco)) expect(app, k).toContain(`${k}: '${t}'`);
    });
  }
  it('conflito é o literal do agente do app', () => {
    expect(ler('src/features/agent/copy.ts')).toContain('`Este horário coincide com: ${nomes.join(\', \')}.`');
    expect(textosNovosEpico5.conflito(['Laura (10:00–10:50)'])).toBe('Este horário coincide com: Laura (10:00–10:50).');
  });
  it('avisos de paciente são os do cartão do agente do app', () => {
    const r = ler('src/features/agent/rascunhos.ts');
    expect(r).toContain('`Escolha qual "${p.termo}"`');
    expect(r).toContain('`"${p.termo}" não está no cadastro. Escolha o paciente`');
    expect(avisosDePacienteDoApp.ambiguo('Ana')).toBe('Escolha qual "Ana"');
    expect(avisosDePacienteDoApp.naoEncontrado('Zé')).toBe('"Zé" não está no cadastro. Escolha o paciente');
  });
  it('sem exclamação nem emoji', () => {
    const t = [textosNovosEpico5.sessoesRegistradas, textosNovosEpico5.pagamentosRegistrados, textosNovosEpico5.registrarTambemPagamento,
      textosNovosEpico5.pedidoDePagamento(['A']), textosNovosEpico5.naoGravadas(['A']), textosNovosEpico5.horariosNaoGravados(['A']),
      textosNovosEpico5.pacienteSemPreco, textosNovosEpico5.formularioAberto('sessão')];
    for (const x of t) expect(x).not.toMatch(/!|\p{Extended_Pictographic}/u);
  });
});
