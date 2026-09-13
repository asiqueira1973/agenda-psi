import * as Crypto from 'expo-crypto';
import { env } from '../env';
import type { NomeDeEvento, PropriedadesDeEvento } from './events';

/**
 * Envio de eventos para o Visão do Produto.
 *
 * Contrato copiado do app atual (`VisaoDoProdutoCall` no Dart), para o formato
 * não mudar junto com a reescrita:
 *
 *   POST /functions/v1/ingest
 *   x-api-key: <chave de ingestão, pública, só escrita>
 *   { "eventos": [ { id, nome, distinct_id, ocorrido_em, tela, descricao,
 *                    propriedades: { ... } } ] }
 *
 * Três regras que este arquivo faz valer:
 *
 * 1. Analytics NUNCA quebra um fluxo. Toda falha é engolida, e nada aqui é
 *    esperado com await por uma tela. Registrar que a sessão aconteceu importa;
 *    registrar que registrou, não.
 * 2. Nenhum evento carrega nome de paciente, valor, observação ou texto
 *    digitado (spec 20.4 e defeito 11.9.18). O tipo `PropriedadesDeEvento` é
 *    fechado justamente para não haver onde colocar.
 * 3. `distinct_id` é o e-mail do psicólogo (20.4) — dado do usuário do app,
 *    nunca do paciente dele.
 *
 * Implementa: 20.4, 21 e a decisão de 13/09/2026 de trocar PostHog por Visão do
 * Produto.
 */

type Evento = {
  nome: NomeDeEvento;
  /** E-mail do psicólogo autenticado. */
  distinctId: string | null;
  /** Nome da tela, no vocabulário que já está no catálogo do Visão do Produto. */
  tela: string;
  /** Frase curta do que aconteceu. O catálogo pode sobrescrever na exibição. */
  descricao: string;
  /**
   * Id do registro criado, quando o evento nasce de uma escrita. Sem ele, um
   * uuid novo — o campo é a chave de deduplicação do lado de lá.
   */
  id?: string;
  propriedades?: PropriedadesDeEvento;
};

/** Tempo máximo esperando o servidor de analytics. Depois disso, desiste. */
const TIMEOUT_MS = 4000;

/**
 * Manda um evento. Não devolve nada e não lança nunca.
 *
 * Dispara e esquece de propósito: quem chama não deve `await`, e por isso a
 * função é `void`. Se a rede estiver ruim, o usuário não pode esperar por causa
 * de um gráfico.
 */
export function track(evento: Evento): void {
  if (!env.analyticsKey) return;

  const corpo = {
    eventos: [
      {
        id: evento.id ?? Crypto.randomUUID(),
        nome: evento.nome,
        distinct_id: evento.distinctId ?? '',
        ocorrido_em: new Date().toISOString(),
        tela: evento.tela,
        descricao: evento.descricao,
        propriedades: evento.propriedades ?? {},
      },
    ],
  };

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);

  void fetch(env.analyticsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.analyticsKey,
    },
    body: JSON.stringify(corpo),
    signal: controle.signal,
  })
    // Silêncio proposital. Falha de analytics não vira erro na tela, não vira
    // alerta e não vira retentativa — vira nada.
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

/**
 * Nomes de tela como já estão gravados no catálogo do Visão do Produto.
 *
 * Vale a mesma regra dos nomes de evento: mudar aqui parte a série. Os quatro
 * primeiros vieram do catálogo; os demais seguem o mesmo vocabulário — minúsculas,
 * sem acento, como os que já existem.
 */
export const telas = {
  novaSessao: 'nova sessao',
  novoPagamento: 'novo pagamento',
  novoAgendamento: 'novo agendamento',
  novoPaciente: 'novo paciente',
  novaDespesa: 'nova despesa',
  atualizarPreco: 'atualizar preco',
  agentePsi: 'agente psi',
  novaConta: 'nova conta',
  login: 'login',
  editarPaciente: 'editar paciente',
  meuPlano: 'meu plano',
  paywall: 'paywall',
  inicio: 'inicio',
} as const;
