import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { logarChamada } from '../../log.js';
import { STATUS_PAGO } from '../../rules/db-literals.js';
import { erros, mensagensDoApp } from '../../rules/messages.js';
import type { ToolContext } from '../context.js';
import {
  DESPESA_RESOURCE_URI,
  entradaSalvarDespesa,
  type DespesaNormalizada,
  type EntradaDespesa,
  type RespostaDoSalvar,
} from './schema.js';
import { resumoDaDespesa, validarDespesa } from './validate.js';

/** Código do Postgres para violação de RLS / permissão. */
const SEM_PERMISSAO = '42501';

/**
 * Grava uma despesa JÁ VALIDADA, como a tela do app grava (P4, `useCriarDespesa`).
 *
 * 1. Confere o tipo em `tipos_despesa`: a policy só mostra os ativos, então inexistente
 *    ou inativo vira erro NO CAMPO, nunca o erro cru do insert (8.2, critério 4).
 * 2. Insert com as mesmas colunas do app: `usuario_id` do token, `pago_em` agora e
 *    `status = 'pago'` (11.10). `metodo` não é gravado, como no app.
 * 3. Evento `agenda_psi_novadespesa`, com a tela `mcp_despesa` (21). A falha dele é engolida.
 *
 * Erro do banco vira a mensagem geral da seção 12, sem texto do Postgres. Devolve
 * `{ ok, ids, resumo }` ou `{ ok: false, erros }`.
 */
export async function gravarDespesa(dados: DespesaNormalizada, ctx: ToolContext): Promise<RespostaDoSalvar> {
  const geral = (mensagem: string): RespostaDoSalvar => ({ ok: false, erros: [{ campo: null, mensagem }] });

  const tipo = await ctx.db
    .from('tipos_despesa')
    .select('id, nome')
    .eq('id', dados.tipo_despesa_id)
    .maybeSingle();
  if (tipo.error) return geral(erros.inesperado);
  if (!tipo.data) {
    return { ok: false, erros: [{ campo: 'tipo_despesa_id', mensagem: mensagensDoApp.tipoDeDespesaNaoEscolhido }] };
  }

  const inserido = await ctx.db
    .from('despesas')
    .insert({
      usuario_id: ctx.sub,
      tipo_despesa_id: dados.tipo_despesa_id,
      valor_despesa: dados.valor_despesa,
      data_competencia: dados.data_competencia,
      pago_em: new Date().toISOString(),
      status: STATUS_PAGO,
      descricao: dados.descricao,
      observacoes: dados.observacoes,
    })
    .select('id')
    .single();
  if (inserido.error || !inserido.data) {
    return geral(inserido.error?.code === SEM_PERMISSAO ? erros.semPermissao : erros.inesperado);
  }

  const id = inserido.data.id;
  await enviarEvento(ctx.config, {
    nome: eventos.novaDespesa,
    id,
    distinctId: ctx.email,
    tela: 'mcp_despesa',
    descricao: 'nova despesa criada',
  });

  return { ok: true, ids: [id], resumo: resumoDaDespesa(tipo.data.nome, dados.valor_despesa, dados.data_competencia) };
}

/**
 * `salvar_despesa` (13.3), só para o app: revalida tudo (P3) e grava. Validação falha
 * sem tocar no banco. Exceção inesperada vira a mensagem geral (12). A resposta vai em
 * `structuredContent`, que o formulário lê para pôr cada erro embaixo do seu campo.
 */
export async function salvarDespesa(entrada: EntradaDespesa, ctx: ToolContext): Promise<RespostaDoSalvar> {
  const v = validarDespesa(entrada);
  if (!v.ok) return { ok: false, erros: v.erros };
  try {
    return await gravarDespesa(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
  }
}

/** Converte a resposta do salvar em resultado MCP, com log sem PII (18). */
export function comoResultado(r: RespostaDoSalvar): CallToolResult {
  const texto = r.ok ? r.resumo : r.erros.map((e) => (e.campo ? `${e.campo}: ${e.mensagem}` : e.mensagem)).join('; ');
  return { content: [{ type: 'text', text: texto }], structuredContent: r };
}

/** Registra `salvar_despesa` com visibilidade só para o app (13.1, 8.2 critério 6). */
export function registrarSalvarDespesa(server: McpServer, ctx: ToolContext): void {
  registerAppTool(
    server,
    'salvar_despesa',
    {
      description: 'Grava a despesa conferida pela pessoa no formulário. Chamada só pelo formulário de despesa.',
      inputSchema: entradaSalvarDespesa,
      _meta: { ui: { resourceUri: DESPESA_RESOURCE_URI, visibility: ['app'] } },
    },
    async (args) => {
      const inicio = performance.now();
      const r = await salvarDespesa(args, ctx);
      logarChamada('salvar_despesa', inicio, r.ok, ctx.sub);
      return comoResultado(r);
    },
  );
}
