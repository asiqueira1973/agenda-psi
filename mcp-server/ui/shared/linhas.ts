import type { Lembranca } from './memoria.js';

/**
 * Estado de um formulário de VÁRIAS linhas (sessões, pagamentos), máquina da seção 12:
 * `carregando → pronto ⇄ salvando → sucesso | pronto com erros`, mais `erro_opcoes` e
 * `cancelado`. Sucesso e cancelado são finais (sem segundo Salvar). Falha parcial (8.5):
 * as linhas gravadas saem do formulário, e só as que faltaram ficam para tentar de novo.
 * Puro: testado em test/ui/linhas.test.ts.
 */
export type EstadoDeLinhas<L> = {
  fase: 'carregando' | 'erro_opcoes' | 'pronto' | 'salvando' | 'sucesso' | 'cancelado';
  linhas: L[];
  /** Candidatos do paciente de cada linha (11.14), para destacar na lista. */
  candidatos: string[][];
  erros: Record<string, string>;
  erroGeral: string | null;
  avisos: string[];
  titulo: string | null;
  resumo: string | null;
  /** Extra do sucesso (ex.: as sessões marcadas "Pagou", para a oferta de pagamento). */
  extra: string[];
};

export type AcaoDeLinhas<L> =
  | { tipo: 'preenchimento'; linhas: L[]; candidatos: string[][]; avisos: string[] }
  | { tipo: 'opcoes_ok' }
  | { tipo: 'opcoes_erro' }
  | { tipo: 'recarregar' }
  | { tipo: 'editar'; linha: number; campo: keyof L & string; valor: L[keyof L] }
  | { tipo: 'erros_locais'; erros: Array<{ campo: string | null; mensagem: string }> }
  | { tipo: 'salvar_inicio' }
  | { tipo: 'salvar_ok'; titulo: string; resumo: string; extra: string[] }
  | { tipo: 'salvar_erro'; erros: Array<{ campo: string | null; mensagem: string }>; gravadas: number[] }
  | { tipo: 'cancelar' }
  | { tipo: 'restaurar'; lembranca: Lembranca };

export function estadoInicialDeLinhas<L>(): EstadoDeLinhas<L> {
  return { fase: 'carregando', linhas: [], candidatos: [], erros: {}, erroGeral: null, avisos: [], titulo: null, resumo: null, extra: [] };
}

function espalhar(lista: Array<{ campo: string | null; mensagem: string }>): Pick<EstadoDeLinhas<unknown>, 'erros' | 'erroGeral'> {
  const erros: Record<string, string> = {};
  let erroGeral: string | null = null;
  for (const e of lista) {
    if (e.campo) erros[e.campo] ??= e.mensagem;
    else erroGeral ??= e.mensagem;
  }
  return { erros, erroGeral };
}

/** Transição pura. Nunca mostra sucesso sem `ok` do servidor (CLAUDE.md). */
export function reduzirLinhas<L>(s: EstadoDeLinhas<L>, a: AcaoDeLinhas<L>): EstadoDeLinhas<L> {
  if (s.fase === 'sucesso' || s.fase === 'cancelado') return s;
  switch (a.tipo) {
    case 'preenchimento':
      return { ...s, linhas: a.linhas, candidatos: a.candidatos, avisos: a.avisos };
    case 'opcoes_ok':
      return { ...s, fase: s.fase === 'salvando' ? s.fase : 'pronto' };
    case 'opcoes_erro':
      return { ...s, fase: 'erro_opcoes' };
    case 'recarregar':
      return { ...s, fase: 'carregando' };
    case 'editar': {
      if (s.fase !== 'pronto') return s;
      const linhas = s.linhas.map((l, i) => (i === a.linha ? { ...l, [a.campo]: a.valor } : l));
      const chave = `${a.linha}.${a.campo}`;
      const { [chave]: _apagado, ...erros } = s.erros;
      return { ...s, linhas, erros, erroGeral: null };
    }
    case 'erros_locais':
      return { ...s, ...espalhar(a.erros) };
    case 'salvar_inicio':
      return s.fase === 'pronto' && s.linhas.length > 0 ? { ...s, fase: 'salvando', erros: {}, erroGeral: null } : s;
    case 'salvar_ok':
      return { ...s, fase: 'sucesso', titulo: a.titulo, resumo: a.resumo, extra: a.extra };
    case 'salvar_erro': {
      // As gravadas saem; os erros por linha foram calculados sobre a lista ANTIGA, então
      // só se mantém o erro geral quando há linha gravada (os índices mudam).
      const ficam = s.linhas.filter((_, i) => !a.gravadas.includes(i));
      const cand = s.candidatos.filter((_, i) => !a.gravadas.includes(i));
      const e = espalhar(a.erros);
      return { ...s, fase: 'pronto', linhas: ficam, candidatos: cand, erros: a.gravadas.length ? {} : e.erros, erroGeral: e.erroGeral };
    }
    case 'cancelar':
      return s.fase === 'salvando' ? s : { ...s, fase: 'cancelado', erros: {}, erroGeral: null };
    case 'restaurar':
      return a.lembranca.fase === 'sucesso'
        ? { ...s, fase: 'sucesso', resumo: a.lembranca.resumo, titulo: a.lembranca.titulo ?? null }
        : { ...s, fase: 'cancelado' };
  }
}
