import { dataValida } from '../../rules/dates.js';
import { formatarData, formatarDinheiro } from '../../rules/format.js';
import { mensagensDoApp, textosNovosDespesa } from '../../rules/messages.js';
import { validarValorEmReais } from '../../rules/money.js';
import {
  MAX_DESCRICAO,
  MAX_OBSERVACOES,
  type DespesaNormalizada,
  type EntradaDespesa,
  type ErroDeCampo,
} from './model.js';

/** Formato de uuid; sem isso, um id torto viraria erro cru do Postgres (22P02). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto livre: espaços nas pontas saem, e vazio vira `null`, como o app grava. */
function textoOuNulo(v: string | null | undefined): string | null {
  const t = typeof v === 'string' ? v.trim() : '';
  return t.length > 0 ? t : null;
}

/**
 * Valida e normaliza uma despesa (P3: a mesma validação na tela e no servidor).
 *
 * Regras: tipo obrigatório, com formato de id (a existência é conferida no banco, em
 * save.ts); valor pela 11.1/11.2; competência obrigatória e real (11.3); descrição até
 * 200 e observações até 1000 (8.2). Todos os erros voltam de uma vez, cada um no seu
 * campo. Função pura: o formulário importa a mesma.
 */
export function validarDespesa(
  e: EntradaDespesa,
): { ok: true; dados: DespesaNormalizada } | { ok: false; erros: ErroDeCampo[] } {
  const erros: ErroDeCampo[] = [];

  const tipo = typeof e.tipo_despesa_id === 'string' ? e.tipo_despesa_id.trim() : '';
  if (!UUID.test(tipo)) erros.push({ campo: 'tipo_despesa_id', mensagem: mensagensDoApp.tipoDeDespesaNaoEscolhido });

  const valor = validarValorEmReais(e.valor_despesa);
  if (!valor.valido) erros.push({ campo: 'valor_despesa', mensagem: valor.mensagem });

  const data = dataValida(typeof e.data_competencia === 'string' ? e.data_competencia.trim() : undefined);
  if (!data) erros.push({ campo: 'data_competencia', mensagem: textosNovosDespesa.dataInvalida });

  const descricao = textoOuNulo(e.descricao);
  if (descricao && descricao.length > MAX_DESCRICAO) {
    erros.push({ campo: 'descricao', mensagem: textosNovosDespesa.descricaoLonga });
  }
  const observacoes = textoOuNulo(e.observacoes);
  if (observacoes && observacoes.length > MAX_OBSERVACOES) {
    erros.push({ campo: 'observacoes', mensagem: textosNovosDespesa.observacoesLongas });
  }

  if (erros.length > 0 || !valor.valido || !data) return { ok: false, erros };
  return {
    ok: true,
    dados: { tipo_despesa_id: tipo, valor_despesa: valor.valor, data_competencia: data, descricao, observacoes },
  };
}

/** Resumo de uma despesa, como volta ao modelo e aparece no sucesso: "Aluguel, R$ 1.450, competência 15/11/2026". */
export function resumoDaDespesa(tipo: string, valor: number, data: string): string {
  return `${tipo}, ${formatarDinheiro(valor)}, competência ${formatarData(data)}`;
}

/**
 * Texto do `updateModelContext` depois do Salvar (8.2, passo 6), literal do spec:
 * "Despesa registrada: <tipo>, R$ <valor>, competência <dd/mm/aaaa> (id <uuid>)."
 */
export function textoParaOModelo(resumo: string, id: string): string {
  return `Despesa registrada: ${resumo} (id ${id}).`;
}
