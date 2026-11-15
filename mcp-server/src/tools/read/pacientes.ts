import * as z from 'zod';
import { normalizar } from '../../rules/text.js';
import type { ResultadoDeLeitura, ToolContext } from '../context.js';

type Ctx = Pick<ToolContext, 'db' | 'sub'>;

/** Teto de linhas de cada histórico (como `MAX_HISTORICO` do agente, 8.4). */
export const MAX_HISTORICO = 30;
/** Teto de pacientes devolvidos pela busca (como o agente, 8.4). */
export const MAX_BUSCA = 5;

/** Data AAAA-MM-DD ou `null`; inválida é ignorada, como no agente. */
const dataOuNulo = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export const entradaBuscarPaciente = z.object({
  nome: z.string().describe('Nome ou parte do nome do paciente.'),
});

/**
 * `buscar_paciente` (13.2), portado de `buscarPaciente` do agente.
 *
 * Pacientes cujo nome contém todas as palavras do termo (sem acento e caixa), no máximo
 * 5, com os horários fixos de cada um numa leitura só. **Sem `observacoes`** (P5): o
 * campo não é lido da view. Sem ids na resposta. Devolve `{ total_encontrado, pacientes }`.
 */
export async function buscarPaciente(args: z.infer<typeof entradaBuscarPaciente>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const procurado = normalizar(args.nome ?? '');
  if (procurado.length === 0) return { erro: 'nome vazio' };

  const { data, error } = await db
    .from('v_pacientes_cartao')
    .select('paciente_id, nome_completo, telefone, email, status, receber_sms, preco_vigente, sessoes_realizadas, sessoes_nao_pagas, ultima_sessao, primeira_consulta, valor_total_pago_ate_hoje')
    .eq('usuario_id', sub);
  if (error) return { erro: 'falha ao ler pacientes' };

  // Cada palavra do termo precisa aparecer no nome: "ana silva" acha "Ana Paula da Silva".
  const palavras = procurado.split(/\s+/);
  const achados = (data ?? []).filter((p) => palavras.every((w) => normalizar(p.nome_completo ?? '').includes(w)));
  const primeiros = achados.slice(0, MAX_BUSCA);

  const ids = primeiros.map((p) => p.paciente_id).filter((id): id is string => !!id);
  const horarios = ids.length
    ? await db
      .from('view_agenda_semana_padrao')
      .select('paciente_id, dia_semana, dia_semana_label, hora_inicio, hora_fim')
      .eq('usuario_id', sub)
      .in('paciente_id', ids)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })
    : { data: [], error: null };
  if (horarios.error) return { erro: 'falha ao ler a agenda' };

  return {
    total_encontrado: achados.length,
    // O id fica de fora do que o modelo lê (8.4).
    pacientes: primeiros.map(({ paciente_id, ...p }) => ({
      ...p,
      horarios_fixos: (horarios.data ?? [])
        .filter((h) => h.paciente_id === paciente_id)
        .map((h) => ({ dia: h.dia_semana_label, inicio: h.hora_inicio?.slice(0, 5), fim: h.hora_fim?.slice(0, 5) })),
    })),
  };
}

export const entradaHistorico = z.object({
  nome: z.string().describe('Nome ou parte do nome do paciente.'),
  desde: z.string().optional().describe('Data inicial AAAA-MM-DD, opcional.'),
  ate: z.string().optional().describe('Data final AAAA-MM-DD, opcional.'),
});

/**
 * `historico_do_paciente` (13.2), portado do agente. Só procede com UM paciente: se o
 * nome casar com vários, devolve os nomes para o modelo perguntar (histórico do paciente
 * errado é pior que nenhum). Sessões e pagamentos, mais recentes primeiro, até 30 de cada,
 * com `pode_haver_mais`. Sessões sem `observacoes` (P5).
 */
export async function historicoDoPaciente(args: z.infer<typeof entradaHistorico>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const procurado = normalizar(args.nome ?? '');
  if (procurado.length === 0) return { erro: 'nome vazio' };
  const desde = dataOuNulo(args.desde);
  const ate = dataOuNulo(args.ate);

  const pacientes = await db.from('pacientes').select('id, nome_completo').eq('usuario_id', sub);
  if (pacientes.error) return { erro: 'falha ao ler pacientes' };
  const palavras = procurado.split(/\s+/);
  const achados = (pacientes.data ?? []).filter((p) => palavras.every((w) => normalizar(p.nome_completo ?? '').includes(w)));
  if (achados.length === 0) return { erro: 'nenhum paciente com esse nome' };
  if (achados.length > 1) return { varios_pacientes: achados.map((p) => p.nome_completo) };
  const paciente = achados[0]!;

  let sessoes = db
    .from('sessoes')
    .select('ocorreu_em_dia, status, pagamento, modalidade, duracao_minutos')
    .eq('usuario_id', sub)
    .eq('paciente_id', paciente.id)
    .order('ocorreu_em_dia', { ascending: false })
    .limit(MAX_HISTORICO);
  if (desde) sessoes = sessoes.gte('ocorreu_em_dia', desde);
  if (ate) sessoes = sessoes.lte('ocorreu_em_dia', ate);

  let pagamentos = db
    .from('pagamentos')
    .select('data_competencia, valor_pagamento, tipo, status')
    .eq('usuario_id', sub)
    .eq('paciente_id', paciente.id)
    .order('data_competencia', { ascending: false })
    .limit(MAX_HISTORICO);
  if (desde) pagamentos = pagamentos.gte('data_competencia', desde);
  if (ate) pagamentos = pagamentos.lte('data_competencia', ate);

  const [s, p] = await Promise.all([sessoes, pagamentos]);
  if (s.error || p.error) return { erro: 'falha ao ler o histórico' };

  return {
    paciente: paciente.nome_completo,
    sessoes: s.data ?? [],
    pagamentos: p.data ?? [],
    // Avisa o modelo quando o corte de linhas pode esconder registro antigo (8.4).
    pode_haver_mais: (s.data?.length ?? 0) === MAX_HISTORICO || (p.data?.length ?? 0) === MAX_HISTORICO,
  };
}

export const entradaListarPacientes = z.object({
  status: z.enum(['ativo', 'inativo']).optional().describe('Filtra por status. Omita para todos.'),
  receber_sms: z.boolean().optional().describe('true para só quem recebe SMS, false para só quem não recebe. Omita para todos.'),
});

/** `listar_pacientes` (13.2), portado do agente: nomes, com filtro opcional por status e SMS. */
export async function listarPacientes(args: z.infer<typeof entradaListarPacientes>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  let consulta = db
    .from('v_pacientes_cartao')
    .select('nome_completo, status, receber_sms')
    .eq('usuario_id', sub)
    .order('nome_completo', { ascending: true });
  if (args.status === 'ativo' || args.status === 'inativo') consulta = consulta.eq('status', args.status);
  if (typeof args.receber_sms === 'boolean') consulta = consulta.eq('receber_sms', args.receber_sms);
  const { data, error } = await consulta;
  if (error) return { erro: 'falha ao ler pacientes' };
  return { total: data?.length ?? 0, pacientes: data ?? [] };
}
