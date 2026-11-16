import { dataValida } from '../../rules/dates.js';
import { tipoDoPagamento, type TipoDoPagamento } from '../../rules/db-literals.js';
import { formatarData, formatarDinheiro } from '../../rules/format.js';
import { mensagensEpico5DoApp } from '../../rules/copy-app.js';
import { textosNovosDespesa } from '../../rules/messages.js';
import { validarValorEmReais } from '../../rules/money.js';

/**
 * Modelo e validação do formulário de pagamentos (8.5, 13.3), puro: o formulário importa
 * daqui e o servidor revalida com as mesmas funções (P3).
 */

/** Uma linha como a pessoa vê; `valor_origem` diz se o valor veio do preço de referência. */
export type LinhaDePagamento = {
  paciente_id: string;
  valor_pagamento: string;
  data_competencia: string;
  tipo: string;
  valor_origem: 'frase' | 'referencia' | 'nenhum';
};

/** Um pagamento pronto para o insert, igual ao `useCriarPagamento` do app (P4). */
export type PagamentoNormalizado = {
  paciente_id: string;
  valor_pagamento: number;
  data_competencia: string;
  tipo: TipoDoPagamento;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = tipoDoPagamento.map((o) => o.valor) as string[];

/**
 * Valida os pagamentos (P3): paciente (11.14), valor inteiro > 0 até 1.000.000 (11.1/11.2,
 * com a mensagem do app), data real (11.3) e tipo entre os literais (11.4; `mensal` se vier
 * outro, como o padrão 11.10). Erros por linha, todos de uma vez.
 */
export function validarPagamentos(linhas: Partial<LinhaDePagamento>[]):
  { ok: true; dados: PagamentoNormalizado[] } | { ok: false; erros: Array<{ campo: string | null; mensagem: string }> } {
  const erros: Array<{ campo: string | null; mensagem: string }> = [];
  const dados: PagamentoNormalizado[] = [];
  if (linhas.length === 0) erros.push({ campo: '0.paciente_id', mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
  linhas.forEach((l, i) => {
    const paciente = (l.paciente_id ?? '').trim();
    if (!UUID.test(paciente)) erros.push({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
    const valor = validarValorEmReais(l.valor_pagamento);
    if (!valor.valido) erros.push({ campo: `${i}.valor_pagamento`, mensagem: valor.mensagem });
    const data = dataValida((l.data_competencia ?? '').trim());
    if (!data) erros.push({ campo: `${i}.data_competencia`, mensagem: textosNovosDespesa.dataInvalida });
    const tipo = (TIPOS.includes(l.tipo ?? '') ? l.tipo : 'mensal') as TipoDoPagamento;
    if (UUID.test(paciente) && valor.valido && data) dados.push({ paciente_id: paciente, valor_pagamento: valor.valor, data_competencia: data, tipo });
  });
  return erros.length ? { ok: false, erros } : { ok: true, dados };
}

/** Rótulo do tipo como a tela mostra ("Por sessão"). */
export const rotuloDoTipo = (v: string) => tipoDoPagamento.find((o) => o.valor === v)?.rotulo ?? v;

/** Resumo: "Beatriz Nogueira, R$ 280, 14/11/2026, Por sessão". */
export function resumoDoPagamento(nome: string, p: PagamentoNormalizado): string {
  return `${nome}, ${formatarDinheiro(p.valor_pagamento)}, ${formatarData(p.data_competencia)}, ${rotuloDoTipo(p.tipo)}`;
}

/** Texto do `updateModelContext` e do fallback (padrão aprovado da despesa). */
export function textoDosPagamentosParaOModelo(resumo: string, ids: string[]): string {
  return `${ids.length === 1 ? 'Pagamento registrado' : 'Pagamentos registrados'}: ${resumo} (${ids.length === 1 ? 'id' : 'ids'} ${ids.join(', ')}).`;
}
