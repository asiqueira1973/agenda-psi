import type {
  ErroDeCampo,
  PreenchimentoDaDespesa,
  RespostaDoSalvar,
  TipoDespesa,
} from '../../src/tools/expense/model.js';
import { validarDespesa } from '../../src/tools/expense/validate.js';
import type { Lembranca } from '../shared/memoria.js';

/** Os campos como a pessoa os vê: tudo texto, inclusive o valor (para recusar "1450,50"). */
export type Campos = PreenchimentoDaDespesa['campos'] & { tipo_despesa_id: string };
export type NomeDoCampo = keyof Campos;

/**
 * Estado do formulário (máquina da seção 12):
 * `carregando → pronto ⇄ (editando) → salvando → sucesso | pronto com erros`, mais
 * `erro_opcoes` quando os tipos não carregam. Em `sucesso` o formulário fica trancado:
 * não há segundo Salvar, o que evita gravar em duplicidade.
 */
export type Estado = {
  fase: 'carregando' | 'erro_opcoes' | 'pronto' | 'salvando' | 'sucesso' | 'cancelado';
  tipos: TipoDespesa[];
  campos: Campos;
  erros: Partial<Record<NomeDoCampo, string>>;
  erroGeral: string | null;
  avisos: string[];
  /** Ids dos tipos que casaram com o que a pessoa disse (11.15), para destacar na lista. */
  candidatos: string[];
  resumo: string | null;
  idSalvo: string | null;
};

export type Acao =
  | { tipo: 'preenchimento'; dados: PreenchimentoDaDespesa }
  | { tipo: 'opcoes_ok'; tipos: TipoDespesa[] }
  | { tipo: 'opcoes_erro' }
  | { tipo: 'recarregar' }
  | { tipo: 'editar'; campo: NomeDoCampo; valor: string }
  | { tipo: 'erros_locais'; erros: ErroDeCampo[] }
  | { tipo: 'salvar_inicio' }
  | { tipo: 'salvar_fim'; resposta: RespostaDoSalvar }
  | { tipo: 'cancelar' }
  | { tipo: 'restaurar'; lembranca: Lembranca };

/** Estado inicial: carregando, campos vazios e a data de hoje vinda do pré-preenchimento. */
export function estadoInicial(): Estado {
  return {
    fase: 'carregando',
    tipos: [],
    campos: { tipo_despesa_id: '', valor_despesa: '', data_competencia: '', descricao: '', observacoes: '' },
    erros: {},
    erroGeral: null,
    avisos: [],
    candidatos: [],
    resumo: null,
    idSalvo: null,
  };
}

/** Distribui os erros do servidor (ou da validação local) pelos campos; `campo: null` é o geral. */
function espalharErros(lista: ErroDeCampo[]): Pick<Estado, 'erros' | 'erroGeral'> {
  const erros: Estado['erros'] = {};
  let erroGeral: string | null = null;
  for (const e of lista) {
    if (e.campo) erros[e.campo] ??= e.mensagem;
    else erroGeral ??= e.mensagem;
  }
  return { erros, erroGeral };
}

/**
 * Transição pura do formulário. Nunca mostra sucesso sem `ok: true` do servidor
 * (CLAUDE.md: "nunca mensagem de sucesso quando a escrita falhou"). Depois do sucesso,
 * nenhuma ação muda mais nada.
 */
export function reduzir(s: Estado, a: Acao): Estado {
  // Sucesso e cancelado são finais: nada mais muda o formulário (sem segundo Salvar).
  if (s.fase === 'sucesso' || s.fase === 'cancelado') return s;
  switch (a.tipo) {
    case 'preenchimento': {
      const c = a.dados.campos;
      return {
        ...s,
        campos: { ...c, tipo_despesa_id: c.tipo_despesa_id ?? '' },
        avisos: a.dados.avisos,
        candidatos: a.dados.candidatos.map((t) => t.id),
      };
    }
    case 'opcoes_ok':
      return { ...s, fase: s.fase === 'salvando' ? s.fase : 'pronto', tipos: a.tipos };
    case 'opcoes_erro':
      return { ...s, fase: 'erro_opcoes' };
    case 'recarregar':
      return { ...s, fase: 'carregando' };
    case 'editar': {
      if (s.fase !== 'pronto') return s;
      const { [a.campo]: _apagado, ...outros } = s.erros;
      return { ...s, campos: { ...s.campos, [a.campo]: a.valor }, erros: outros, erroGeral: null };
    }
    case 'erros_locais':
      return { ...s, ...espalharErros(a.erros) };
    case 'salvar_inicio':
      return podeSalvar(s) ? { ...s, fase: 'salvando', erros: {}, erroGeral: null } : s;
    case 'cancelar':
      return s.fase === 'salvando' ? s : { ...s, fase: 'cancelado', erros: {}, erroGeral: null };
    case 'restaurar':
      // O host remontou o formulário de uma abertura que já terminou (memoria.ts).
      return a.lembranca.fase === 'sucesso'
        ? { ...s, fase: 'sucesso', resumo: a.lembranca.resumo, idSalvo: a.lembranca.idSalvo }
        : { ...s, fase: 'cancelado' };
    case 'salvar_fim':
      if (a.resposta.ok) {
        return { ...s, fase: 'sucesso', resumo: a.resposta.resumo, idSalvo: a.resposta.ids[0] ?? null };
      }
      return { ...s, fase: 'pronto', ...espalharErros(a.resposta.erros) };
  }
}

/** Obrigatórios da 8.2: tipo, valor e competência. Fora de `pronto`, o botão fica desabilitado. */
export function podeSalvar(s: Estado): boolean {
  const { tipo_despesa_id, valor_despesa, data_competencia } = s.campos;
  return s.fase === 'pronto' && !!tipo_despesa_id && !!valor_despesa.trim() && !!data_competencia;
}

/**
 * Validação local antes de chamar o servidor (P3: a mesma regra dos dois lados).
 * Devolve os erros, ou lista vazia se pode enviar.
 */
export function errosLocais(s: Estado): ErroDeCampo[] {
  const v = validarDespesa(s.campos);
  return v.ok ? [] : v.erros;
}
