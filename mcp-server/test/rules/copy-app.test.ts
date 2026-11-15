import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avisosDePacienteDoApp, categoriasDoFeedbackDoApp, copyFeedbackDoApp, copyPacientesDoApp, emailInvalidoDoApp, horarioDoPacienteNovoDoApp, sucessoPacienteDoApp, copyAgendaDoApp, diasDoApp, sucessoHorarioDoApp, copyPagamentosDoApp, copySessoesDoApp, mensagensEpico5DoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';

const ler = (c: string) => readFileSync(new URL(`../../../app/${c}`, import.meta.url), 'utf8');

describe('copy do épico 5 igual à do app (15)', () => {
  const casos: Array<[string, Record<string, string>]> = [
    ['src/features/sessions/copy.ts', copySessoesDoApp],
    ['src/features/sessions/copy.ts', copyPagamentosDoApp],
    ['src/features/schedule/copy.ts', copyAgendaDoApp],
    ['src/lib/validation.ts', mensagensEpico5DoApp],
    ['src/features/patients/copy.ts', copyPacientesDoApp],
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
  it('dias na ordem visual do app, com o valor do banco (pegadinha 7)', () => {
    const app = ler('src/features/schedule/copy.ts');
    for (const d of diasDoApp) expect(app).toContain(`{ valor: ${d.valor}, rotulo: '${d.rotulo}' }`);
    expect(diasDoApp[0]).toEqual({ valor: 7, rotulo: 'Dom' });
    expect(app).toContain(`sucessoCriado: '${sucessoHorarioDoApp}'`);
  });
  it('paciente: sucesso, e-mail inválido e título do horário são os do app', () => {
    expect(ler('src/features/patients/copy.ts')).toContain('sucessoCriado: (nome: string) => `${nome} cadastrado.`');
    expect(sucessoPacienteDoApp('Laura')).toBe('Laura cadastrado.');
    expect(ler('src/features/auth/copy.ts')).toContain(`emailInvalido: '${emailInvalidoDoApp}'`);
    expect(ler('src/features/agent/copy.ts')).toContain(`tituloDeHorarioDoPacienteNovo: '${horarioDoPacienteNovoDoApp}'`);
  });
  it('feedback: textos da tela de Ajustes e do cartão do agente', () => {
    const ajustes = ler('src/features/settings/copy.ts');
    const agente = ler('src/features/agent/copy.ts');
    const rascunhos = ler('src/features/agent/rascunhos.ts');
    for (const k of ['placeholder', 'enviar', 'enviando', 'sucesso'] as const) expect(ajustes, k).toContain(`${k}: '${copyFeedbackDoApp[k]}'`);
    expect(agente).toContain(`feedback: '${copyFeedbackDoApp.titulo}'`);
    expect(agente).toContain(`mensagemDoFeedback: '${copyFeedbackDoApp.mensagem}'`);
    expect(agente).toContain(`avisoDoFeedback: '${copyFeedbackDoApp.aviso}'`);
    expect(rascunhos).toContain(`['${copyFeedbackDoApp.vazia}']`);
    expect(rascunhos).toContain(`{ ${categoriasDoFeedbackDoApp.map((c) => `${c.valor}: '${c.rotulo}'`).join(', ')} }`);
  });
  it('sem exclamação nem emoji', () => {
    const t = [textosNovosEpico5.sessoesRegistradas, textosNovosEpico5.pagamentosRegistrados, textosNovosEpico5.registrarTambemPagamento,
      textosNovosEpico5.pedidoDePagamento(['A']), textosNovosEpico5.naoGravadas(['A']), textosNovosEpico5.horariosNaoGravados(['A']),
      textosNovosEpico5.pacienteSemPreco, textosNovosEpico5.formularioAberto('sessão'), textosNovosEpico5.horariosCriados, textosNovosEpico5.duracaoInvalida];
    for (const x of t) expect(x).not.toMatch(/!|\p{Extended_Pictographic}/u);
  });
});
