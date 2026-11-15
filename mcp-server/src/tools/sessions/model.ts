import { dataValida } from '../../rules/dates.js';
import { modalidadeDaSessao, pagamentoDaSessao, type ModalidadeDaSessao, type PagamentoDaSessao } from '../../rules/db-literals.js';
import { formatarData } from '../../rules/format.js';
import { mensagensEpico5DoApp } from '../../rules/copy-app.js';
import { textosNovosDespesa } from '../../rules/messages.js';

/**
 * Modelo e validação do formulário de sessões (8.5, 13.3), sem zod e sem Supabase: o
 * formulário importa daqui, e o servidor revalida com as mesmas funções (P3).
 */

/** Uma linha como a pessoa vê: tudo texto, menos o "será cobrada". */
export type LinhaDeSessao = {
  paciente_id: string;
  ocorreu_em_dia: string;
  pagamento: string;
  modalidade: string;
  duracao_minutos: string;
  devesercobrada: boolean;
};

/** Uma sessão pronta para o insert, igual ao `useCriarSessao` do app (P4). */
export type SessaoNormalizada = {
  paciente_id: string;
  ocorreu_em_dia: string;
  pagamento: PagamentoDaSessao;
  modalidade: ModalidadeDaSessao;
  duracao_minutos: number;
  devesercobrada: boolean;
};

/** Erro de uma linha: `campo` é `<indice>.<coluna>`, para o formulário pôr embaixo do campo certo. */
export type ErroDeLinha = { campo: string | null; mensagem: string };

/** Padrões da tela "Registrar sessão" do app e da regra 11.9. */
export const PADRAO_SESSAO = {
  pagamento: 'pagamento mensal' as PagamentoDaSessao,
  modalidade: 'presencial' as ModalidadeDaSessao,
  duracao_minutos: '50',
  devesercobrada: true,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGAMENTOS = pagamentoDaSessao.map((o) => o.valor) as string[];
const MODALIDADES = modalidadeDaSessao.map((o) => o.valor) as string[];

/**
 * Valida as sessões (P3): paciente escolhido (11.14), data real (11.3), duração inteira de
 * 1 a 600 (11.8), pagamento e modalidade entre os literais do banco (11.4). Vazio na
 * duração vira 50, como a tela do app. Todos os erros voltam de uma vez, por linha.
 */
export function validarSessoes(linhas: Partial<LinhaDeSessao>[]):
  { ok: true; dados: SessaoNormalizada[] } | { ok: false; erros: ErroDeLinha[] } {
  const erros: ErroDeLinha[] = [];
  const dados: SessaoNormalizada[] = [];
  if (linhas.length === 0) erros.push({ campo: '0.paciente_id', mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
  linhas.forEach((l, i) => {
    const paciente = (l.paciente_id ?? '').trim();
    if (!UUID.test(paciente)) erros.push({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
    const data = dataValida((l.ocorreu_em_dia ?? '').trim());
    if (!data) erros.push({ campo: `${i}.ocorreu_em_dia`, mensagem: textosNovosDespesa.dataInvalida });
    const textoDuracao = (l.duracao_minutos ?? '').trim() || PADRAO_SESSAO.duracao_minutos;
    const duracao = /^\d+$/.test(textoDuracao) ? Number(textoDuracao) : NaN;
    // Sem mensagem própria no app para duração: a regra 11.8 fica no servidor, e o campo
    // inválido volta ao padrão de 50, como o agente faz.
    const duracaoOk = Number.isInteger(duracao) && duracao >= 1 && duracao <= 600 ? duracao : 50;
    const pagamento = PAGAMENTOS.includes(l.pagamento ?? '') ? (l.pagamento as PagamentoDaSessao) : PADRAO_SESSAO.pagamento;
    const modalidade = MODALIDADES.includes(l.modalidade ?? '') ? (l.modalidade as ModalidadeDaSessao) : PADRAO_SESSAO.modalidade;
    if (data && UUID.test(paciente)) {
      dados.push({ paciente_id: paciente, ocorreu_em_dia: data, pagamento, modalidade, duracao_minutos: duracaoOk, devesercobrada: l.devesercobrada !== false });
    }
  });
  return erros.length ? { ok: false, erros } : { ok: true, dados };
}

/** Rótulo do pagamento como a tela mostra ("Não pagou"), a partir do literal ("nao pagou"). */
export function rotuloDoPagamento(valor: string): string {
  return pagamentoDaSessao.find((o) => o.valor === valor)?.rotulo ?? valor;
}

/** Resumo de uma sessão: "Beatriz Nogueira, 14/11/2026, Pagou". */
export function resumoDaSessao(nome: string, s: Pick<SessaoNormalizada, 'ocorreu_em_dia' | 'pagamento'>): string {
  return `${nome}, ${formatarData(s.ocorreu_em_dia)}, ${rotuloDoPagamento(s.pagamento)}`;
}

/** Título do sucesso: o do app para uma, o do spec (aprovado) para várias. */
export function tituloDoSucesso(quantidade: number, um: string, varios: string): string {
  return quantidade === 1 ? um : varios;
}

/** Texto do `updateModelContext` e do fallback, no padrão aprovado da despesa (8.2, passo 6). */
export function textoDasSessoesParaOModelo(resumo: string, ids: string[]): string {
  return `${ids.length === 1 ? 'Sessão registrada' : 'Sessões registradas'}: ${resumo} (${ids.length === 1 ? 'id' : 'ids'} ${ids.join(', ')}).`;
}
