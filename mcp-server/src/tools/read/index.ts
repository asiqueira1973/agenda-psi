import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod';
import { executar, type ResultadoDeLeitura, type ToolContext } from '../context.js';
import { agendaDaSemana, agendaDoDia, entradaDia, entradaSemana } from './agenda.js';
import { consultarDespesas, entrada as entradaDespesas } from './consultar-despesas.js';
import { descricoes } from './descricoes.js';
import {
  consultarMes,
  consultarPeriodo,
  entradaMes,
  entradaPendencias,
  entradaPeriodo,
  listarPendencias,
} from './financeiro.js';
import {
  buscarPaciente,
  entradaBuscarPaciente,
  entradaHistorico,
  entradaListarPacientes,
  historicoDoPaciente,
  listarPacientes,
} from './pacientes.js';

/** Uma leitura: nome (contrato com o modelo), schema e a função que consulta. */
type Leitura = {
  nome: keyof typeof descricoes;
  entrada: z.ZodObject;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executar: (args: any, ctx: Pick<ToolContext, 'db' | 'sub'>) => Promise<ResultadoDeLeitura>;
};

/** As 9 leituras do agente (13.2), na ordem do agente. */
export const LEITURAS: Leitura[] = [
  { nome: 'buscar_paciente', entrada: entradaBuscarPaciente, executar: buscarPaciente },
  { nome: 'historico_do_paciente', entrada: entradaHistorico, executar: historicoDoPaciente },
  { nome: 'consultar_despesas', entrada: entradaDespesas, executar: consultarDespesas },
  { nome: 'listar_pacientes', entrada: entradaListarPacientes, executar: listarPacientes },
  { nome: 'consultar_periodo', entrada: entradaPeriodo, executar: consultarPeriodo },
  { nome: 'consultar_mes', entrada: entradaMes, executar: consultarMes },
  { nome: 'agenda_do_dia', entrada: entradaDia, executar: agendaDoDia },
  { nome: 'agenda_da_semana', entrada: entradaSemana, executar: agendaDaSemana },
  { nome: 'listar_pendencias', entrada: entradaPendencias, executar: listarPendencias },
];

/**
 * Registra as 9 leituras (13.1 e 13.2): visíveis ao modelo, `readOnlyHint`, descrição do
 * agente e `executar`, que converte `{ erro }` em `isError` e loga sem PII (18).
 */
export function registrarLeituras(server: McpServer, ctx: ToolContext): void {
  for (const l of LEITURAS) {
    server.registerTool(
      l.nome,
      { description: descricoes[l.nome], inputSchema: l.entrada, annotations: { readOnlyHint: true }, _meta: { ui: { visibility: ['model'] } } },
      (args: unknown) => executar(l.nome, ctx, () => l.executar(args, ctx)),
    );
  }
}
