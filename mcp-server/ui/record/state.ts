import type { Candidato, ErroDeRegistro, PreenchimentoDeRegistro } from '../../src/tools/records/tipos.js';
import type { Lembranca } from '../shared/memoria.js';

/**
 * Estado do formulário genérico de edição e exclusão (épico 6, 8.6), máquina da seção 12:
 * `carregando → pronto ⇄ salvando → sucesso | pronto com erros`, mais `confirmando` na
 * exclusão (segundo clique, "Excluir definitivamente") e `cancelado`. Sucesso e cancelado
 * são finais. Puro: testado em test/records/estado.test.ts.
 */

export type Fase = 'carregando' | 'pronto' | 'confirmando' | 'salvando' | 'sucesso' | 'cancelado';

export type EstadoDeRegistro = {
  fase: Fase;
  dados: PreenchimentoDeRegistro | null;
  pacienteId: string;
  candidatos: Candidato[];
  escolhido: string | null;
  /** O que a pessoa digitou, por registro: trocar de registro não perde nada. */
  valores: Record<string, Record<string, string>>;
  erros: Record<string, string>;
  erroGeral: string | null;
  /** Devolvido pelo servidor numa falha parcial, para mandar no próximo Salvar. */
  continuar: Record<string, string>;
  titulo: string | null;
  resumo: string | null;
  carregando: boolean;
};

export type AcaoDeRegistro =
  | { tipo: 'preenchimento'; dados: PreenchimentoDeRegistro }
  | { tipo: 'paciente'; pacienteId: string }
  | { tipo: 'candidatos'; candidatos: Candidato[]; escolhido: string | null }
  | { tipo: 'candidatos_erro'; mensagem: string }
  | { tipo: 'escolher'; id: string }
  | { tipo: 'editar'; campo: string; valor: string }
  | { tipo: 'pedir_confirmacao' }
  | { tipo: 'salvar_inicio' }
  | { tipo: 'salvar_ok'; titulo: string; resumo: string }
  | { tipo: 'salvar_erro'; erros: ErroDeRegistro[]; continuar?: Record<string, string> }
  | { tipo: 'cancelar' }
  | { tipo: 'restaurar'; lembranca: Lembranca };

export function estadoInicialDeRegistro(): EstadoDeRegistro {
  return { fase: 'carregando', dados: null, pacienteId: '', candidatos: [], escolhido: null, valores: {}, erros: {}, erroGeral: null, continuar: {}, titulo: null, resumo: null, carregando: false };
}

/** Os valores iniciais de cada candidato: o que o servidor preencheu. */
const valoresIniciais = (cs: Candidato[]) =>
  Object.fromEntries(cs.map((c) => [c.id, Object.fromEntries(c.campos.filter((x) => x.tipo !== 'leitura').map((x) => [x.nome, x.valor]))]));

export function reduzirRegistro(s: EstadoDeRegistro, a: AcaoDeRegistro): EstadoDeRegistro {
  switch (a.tipo) {
    case 'preenchimento':
      return { ...s, fase: 'pronto', dados: a.dados, pacienteId: a.dados.paciente?.paciente_id ?? '', candidatos: a.dados.candidatos, escolhido: a.dados.escolhido, valores: valoresIniciais(a.dados.candidatos) };
    case 'paciente':
      // Paciente novo: os candidatos antigos saem até chegarem os dele.
      return s.fase === 'pronto' ? { ...s, pacienteId: a.pacienteId, candidatos: [], escolhido: null, valores: {}, erros: {}, erroGeral: null, carregando: !!a.pacienteId } : s;
    case 'candidatos':
      return { ...s, candidatos: a.candidatos, escolhido: a.escolhido, valores: valoresIniciais(a.candidatos), carregando: false };
    case 'candidatos_erro':
      return { ...s, carregando: false, erroGeral: a.mensagem };
    case 'escolher':
      return s.fase === 'pronto' || s.fase === 'confirmando' ? { ...s, fase: 'pronto', escolhido: a.id, erros: {}, erroGeral: null, continuar: {} } : s;
    case 'editar': {
      if (s.fase !== 'pronto' || !s.escolhido) return s;
      const { [a.campo]: _apagado, ...erros } = s.erros;
      return { ...s, valores: { ...s.valores, [s.escolhido]: { ...s.valores[s.escolhido], [a.campo]: a.valor } }, erros, erroGeral: null };
    }
    case 'pedir_confirmacao':
      return s.fase === 'pronto' && s.escolhido ? { ...s, fase: 'confirmando' } : s;
    case 'salvar_inicio': {
      const pode = s.escolhido && (s.dados?.modo === 'exclusao' ? s.fase === 'confirmando' : s.fase === 'pronto');
      return pode ? { ...s, fase: 'salvando', erros: {}, erroGeral: null } : s;
    }
    case 'salvar_ok':
      return { ...s, fase: 'sucesso', titulo: a.titulo, resumo: a.resumo };
    case 'salvar_erro': {
      const erros = Object.fromEntries(a.erros.filter((e) => e.campo).map((e) => [e.campo as string, e.mensagem]));
      const geral = a.erros.filter((e) => !e.campo).map((e) => e.mensagem).join(' ') || null;
      return { ...s, fase: 'pronto', erros, erroGeral: geral, continuar: a.continuar ?? s.continuar };
    }
    case 'cancelar':
      // Sucesso é final (12): Cancelar depois de gravar não pode dizer "nada foi registrado".
      return s.fase === 'salvando' || s.fase === 'sucesso' ? s : { ...s, fase: 'cancelado', erros: {}, erroGeral: null };
    case 'restaurar':
      return a.lembranca.fase === 'sucesso'
        ? { ...s, fase: 'sucesso', resumo: a.lembranca.resumo, titulo: a.lembranca.titulo ?? null }
        : { ...s, fase: 'cancelado' };
  }
}

/** O candidato escolhido, se houver. */
export const candidatoEscolhido = (s: EstadoDeRegistro) => s.candidatos.find((c) => c.id === s.escolhido) ?? null;
