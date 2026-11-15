import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { avisosDePacienteDoApp } from '../../rules/copy-app.js';
import { resolverPaciente, type OpcaoDePaciente } from '../../rules/patient-match.js';
import { executar, type ResultadoDeLeitura, type ToolContext } from '../context.js';

/** Paciente como opção de escolha, com o `ativo` que ordena a ambiguidade (11.14). */
export type PacienteOpcao = OpcaoDePaciente & { ativo: boolean };

/**
 * Lê os pacientes como opções, igual a `lerPacientes` do agente: `v_pacientes_cartao`
 * (id, nome, `preco_vigente` como preço de referência, status), ordenados por nome.
 * O preço vem da view e nunca é calculado (pegadinha 2, regra 11.11). Sem `observacoes`
 * (P5). Devolve `null` se o banco falhar.
 */
export async function lerPacientesOpcoes({ db, sub }: Pick<ToolContext, 'db' | 'sub'>): Promise<PacienteOpcao[] | null> {
  const { data, error } = await db
    .from('v_pacientes_cartao')
    .select('paciente_id, nome_completo, preco_vigente, status')
    .eq('usuario_id', sub)
    .order('nome_completo', { ascending: true });
  if (error) return null;
  return (data ?? [])
    .filter((p) => p.paciente_id)
    .map((p) => ({ id: p.paciente_id as string, nome: p.nome_completo ?? '', preco_referencia: p.preco_vigente ?? null, ativo: p.status === 'ativo' }));
}

/** `{ pacientes }` ou `{ erro }`, para o formulário. */
export async function listarPacientesOpcoes(ctx: Pick<ToolContext, 'db' | 'sub'>): Promise<ResultadoDeLeitura> {
  const pacientes = await lerPacientesOpcoes(ctx);
  return pacientes ? { pacientes } : { erro: 'falha ao ler pacientes' };
}

/**
 * Registra `buscar_pacientes_opcoes` (13.3), só para o app: o seletor de paciente dos
 * formulários de sessão, pagamento e horário. Dezenas de pacientes por pessoa (17): a busca
 * e o autocomplete são feitos no formulário, sobre a lista inteira.
 */
export function registrarBuscarPacientesOpcoes(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'buscar_pacientes_opcoes',
    {
      description: 'Lista os pacientes (id, nome, preço de referência, ativo) para os formulários escolherem.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { visibility: ['app'] } },
    },
    () => executar('buscar_pacientes_opcoes', ctx, () => listarPacientesOpcoes(ctx)),
  );
}

/** O paciente de uma linha do pré-preenchimento: escolhido, ou vazio com candidatos. */
export type PacienteDaLinha = { paciente_id: string; termo: string; candidatos: Array<{ id: string; nome: string }> };

/**
 * Resolve o nome dito para o seletor do formulário (11.14, `resolverPaciente`): um
 * casamento preenche; ambíguo deixa VAZIO com os candidatos; não encontrado deixa vazio.
 * O aviso é o do cartão do agente do app. Nunca escolhe sozinho entre dois.
 */
export function pacienteParaFormulario(termo: string | undefined, pacientes: PacienteOpcao[]):
  { linha: PacienteDaLinha; aviso: string | null } {
  const t = (termo ?? '').trim();
  if (!t) return { linha: { paciente_id: '', termo: '', candidatos: [] }, aviso: null };
  const r = resolverPaciente(t, pacientes);
  if (r.situacao === 'ok') return { linha: { paciente_id: r.id, termo: t, candidatos: [] }, aviso: null };
  if (r.situacao === 'ambiguo') {
    return { linha: { paciente_id: '', termo: t, candidatos: r.opcoes.map((o) => ({ id: o.id, nome: o.nome })) }, aviso: avisosDePacienteDoApp.ambiguo(t) };
  }
  return { linha: { paciente_id: '', termo: t, candidatos: [] }, aviso: avisosDePacienteDoApp.naoEncontrado(t) };
}
