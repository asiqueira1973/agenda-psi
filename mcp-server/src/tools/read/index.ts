import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventosDoConector } from '../../events.js';
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
 *
 * Leitura que deu certo emite `agenda_psi_mcp_consulta` com `tela: mcp_<leitura>`
 * (divergência 12), sem argumento nem resultado no evento. As listas internas dos
 * formulários (pacientes, tipos de despesa, agenda) não passam por aqui e não contam.
 */
export function registrarLeituras(server: McpServer, ctx: ToolContext): void {
  for (const l of LEITURAS) {
    server.registerTool(
      l.nome,
      { description: descricoes[l.nome], inputSchema: l.entrada, annotations: { readOnlyHint: true }, _meta: { ui: { visibility: ['model'] } } },
      async (args: unknown) => {
        const r = await executar(l.nome, ctx, () => l.executar(args, ctx));
        if (!r.isError) {
          await enviarEvento(ctx.config, {
            nome: eventosDoConector.consultaFeita,
            id: '',
            distinctId: ctx.email,
            tela: `mcp_${l.nome}`,
            descricao: 'consulta feita',
          });
        }
        return r;
      },
    );
  }
}
