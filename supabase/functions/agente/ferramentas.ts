import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * As ferramentas de CONSULTA do agente — fase 1 de docs/agente-plano.md.
 *
 * Três regras valem para todas:
 *
 * 1. A IA nunca escreve SQL. Ela escolhe uma destas funções e preenche os
 *    parâmetros; quem monta a consulta é este arquivo.
 * 2. Toda leitura usa o cliente autenticado COMO o usuário. As views lidas aqui
 *    são `security_invoker`, então a RLS vale; o filtro por `usuario_id` abaixo
 *    é uma segunda tranca, não a primeira.
 * 3. Os números vêm prontos das views (princípio P2). Aqui só se escolhe linha e
 *    se formata; não se soma dinheiro.
 *
 * Nenhuma ferramenta desta fase grava nada.
 */

/** Definições no formato do campo `tools` da API de Mensagens da Anthropic. */
export const definicoesDeFerramentas = [
  {
    name: 'buscar_paciente',
    description:
      'Procura pacientes pelo nome (aceita parte do nome, sem acento). Devolve até 5, com status, preço atual de referência, sessões realizadas, sessões não pagas, última sessão, primeira consulta e total pago. Use sempre que a pergunta citar um paciente pelo nome.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome ou parte do nome do paciente.' },
      },
      required: ['nome'],
    },
  },
  {
    name: 'consultar_mes',
    description:
      'Números de um mês: quanto foi recebido, quanto está pendente de pagamentos, e quantas sessões realizadas houve. Use para perguntas como "quanto recebi em outubro?" ou "quantas sessões fiz este mês?".',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'Mês no formato AAAA-MM, por exemplo 2026-10.' },
      },
      required: ['mes'],
    },
  },
  {
    name: 'agenda_do_dia',
    description:
      'Os horários fixos da agenda semanal num dia: hora de início, hora de fim e paciente, em ordem. A agenda é uma semana-padrão que se repete; não diz se a sessão aconteceu. Use para "qual é a minha agenda de hoje?", "quem eu atendo amanhã?" ou "o que tenho na quinta?".',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data no formato AAAA-MM-DD. Para "hoje", use a data de hoje.' },
      },
      required: ['data'],
    },
  },
  {
    name: 'listar_pendencias',
    description:
      'Lista os pacientes com pagamentos pendentes ou vencidos, com quantidade, total pendente e o vencimento mais antigo, e também os pacientes com sessões marcadas como "não pagou". Use para "quem não pagou?" ou "quem está me devendo?".',
    input_schema: { type: 'object', properties: {} },
  },
] as const;

export type NomeDeFerramenta = (typeof definicoesDeFerramentas)[number]['name'];

/**
 * Tira acento e caixa, para "jose" achar "José". O banco tem `unaccent`, mas as
 * views não expõem coluna normalizada; com dezenas de pacientes por pessoa,
 * filtrar aqui é mais simples que criar RPC nova só para isso.
 */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Executa a ferramenta pedida pela IA.
 *
 * Recebe o nome, a entrada que a IA preencheu, o cliente do usuário e o id dele
 * (vindo do JWT, nunca do corpo — pegadinha 3).
 * Devolve: um objeto serializável, que volta para a IA como `tool_result`.
 * Entrada inválida vira `{ erro }`, não exceção: a IA lê o erro e se corrige.
 */
export async function executarFerramenta(
  nome: string,
  entrada: Record<string, unknown>,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<unknown> {
  switch (nome) {
    case 'buscar_paciente':
      return await buscarPaciente(String(entrada.nome ?? ''), cliente, usuarioId);
    case 'consultar_mes':
      return await consultarMes(String(entrada.mes ?? ''), cliente, usuarioId);
    case 'agenda_do_dia':
      return await agendaDoDia(String(entrada.data ?? ''), cliente, usuarioId);
    case 'listar_pendencias':
      return await listarPendencias(cliente, usuarioId);
    default:
      return { erro: `ferramenta desconhecida: ${nome}` };
  }
}

/** Pacientes cujo nome contém o termo, ignorando acento e caixa. */
async function buscarPaciente(termo: string, cliente: SupabaseClient, usuarioId: string) {
  const procurado = normalizar(termo);
  if (procurado.length === 0) return { erro: 'nome vazio' };

  const { data, error } = await cliente
    .from('v_pacientes_cartao')
    .select(
      'nome_completo, status, preco_vigente, sessoes_realizadas, sessoes_nao_pagas, ultima_sessao, primeira_consulta, valor_total_pago_ate_hoje',
    )
    .eq('usuario_id', usuarioId);
  if (error) return { erro: 'falha ao ler pacientes' };

  // Cada palavra do termo precisa aparecer no nome: "ana silva" acha
  // "Ana Paula da Silva", mas não "Ana Souza".
  const palavras = procurado.split(/\s+/);
  const achados = (data ?? []).filter((p) => {
    const nome = normalizar(p.nome_completo ?? '');
    return palavras.every((w) => nome.includes(w));
  });

  return {
    total_encontrado: achados.length,
    pacientes: achados.slice(0, 5),
  };
}

/** Recebido, pendente e sessões realizadas de um mês. */
async function consultarMes(mes: string, cliente: SupabaseClient, usuarioId: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { erro: 'mês deve ser AAAA-MM' };

  const inicio = `${mes}-01`;
  const [ano, m] = mes.split('-').map(Number);
  const proximo = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;

  const financeiro = await cliente
    .from('v_financeiro_mensal')
    .select('recebido, pendente')
    .eq('usuario_id', usuarioId)
    .eq('mes_referencia', inicio)
    .maybeSingle();
  if (financeiro.error) return { erro: 'falha ao ler o financeiro' };

  // Contagem, não soma de dinheiro: mesma definição de "realizada" que
  // `v_pacientes_cartao` usa.
  const sessoes = await cliente
    .from('sessoes')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('status', 'realizada')
    .gte('ocorreu_em_dia', inicio)
    .lt('ocorreu_em_dia', proximo);
  if (sessoes.error) return { erro: 'falha ao contar sessões' };

  return {
    mes,
    recebido: financeiro.data?.recebido ?? 0,
    pendente: financeiro.data?.pendente ?? 0,
    sessoes_realizadas: sessoes.count ?? 0,
  };
}

/**
 * Dia da semana na convenção DO BANCO: 1 = segunda, 7 = domingo (pegadinha 7).
 *
 * Não é a do JavaScript, onde 0 é domingo. A data vem como AAAA-MM-DD e é lida
 * em UTC de propósito: é só um dia do calendário, sem hora, e ler no fuso do
 * servidor poderia voltar um dia.
 *
 * Devolve `null` se a data não for válida.
 */
export function diaDaSemanaDoBanco(data: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data) return null;
  const js = d.getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

/** Os horários fixos da semana-padrão que caem no dia da data pedida. */
async function agendaDoDia(data: string, cliente: SupabaseClient, usuarioId: string) {
  const dia = diaDaSemanaDoBanco(data);
  if (dia === null) return { erro: 'data deve ser AAAA-MM-DD' };

  const { data: horarios, error } = await cliente
    .from('view_agenda_semana_padrao')
    .select('dia_semana_label, hora_inicio, hora_fim, paciente_nome')
    .eq('usuario_id', usuarioId)
    .eq('dia_semana', dia)
    .order('hora_inicio', { ascending: true });
  if (error) return { erro: 'falha ao ler a agenda' };

  return {
    data,
    dia_da_semana: horarios?.[0]?.dia_semana_label ?? null,
    horarios: (horarios ?? []).map((h) => ({
      inicio: h.hora_inicio?.slice(0, 5),
      fim: h.hora_fim?.slice(0, 5),
      paciente: h.paciente_nome,
    })),
  };
}

/** Quem deve: pagamentos pendentes e sessões marcadas como "não pagou". */
async function listarPendencias(cliente: SupabaseClient, usuarioId: string) {
  const pagamentos = await cliente
    .from('v_pendencias_por_paciente')
    .select('nome_completo, qtde_pendencias, total_pendente, proximo_vencimento')
    .eq('usuario_id', usuarioId)
    .gt('qtde_pendencias', 0)
    .order('total_pendente', { ascending: false });
  if (pagamentos.error) return { erro: 'falha ao ler pendências' };

  const sessoes = await cliente
    .from('v_pacientes_cartao')
    // Sem preço: o preço do cadastro é referência, não o valor cobrado
    // naquela sessão. Com ele no resultado, a IA multiplicava e apresentava
    // como dívida um número que nenhum registro tem.
    .select('nome_completo, sessoes_nao_pagas')
    .eq('usuario_id', usuarioId)
    .gt('sessoes_nao_pagas', 0)
    .order('sessoes_nao_pagas', { ascending: false });
  if (sessoes.error) return { erro: 'falha ao ler sessões não pagas' };

  return {
    pagamentos_pendentes: pagamentos.data ?? [],
    sessoes_nao_pagas: sessoes.data ?? [],
  };
}
