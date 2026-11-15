import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { logarChamada } from '../../log.js';
import { conferirTokenDePrevia, emitirTokenDePrevia } from '../../preview-token.js';
import { hojeEmSaoPaulo } from '../../rules/dates.js';
import { formatarData, formatarDinheiro } from '../../rules/format.js';
import { erros, textosParaOModelo } from '../../rules/messages.js';
import type { ToolContext } from '../context.js';
import { lerTiposDespesa } from './options.js';
import { avisoDoTipo, resolverTipo } from './resolve-type.js';
import { gravarDespesa } from './save.js';
import { type DespesaNormalizada, type ErroDeCampo, type TipoDespesa } from './schema.js';
import { textoParaOModelo, validarDespesa } from './validate.js';

/** Nome da ação no HMAC: amarra o token a esta ferramenta (13.4). */
const ACAO = 'registrar_despesa';

/** Descrição para o modelo, com a instrução literal da 13.4. */
export const DESCRICAO =
  'Registra UMA despesa do consultório em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia, as pendências e um token_previa; nada é gravado. Mostre a prévia à pessoa e pergunte se está certo. Se ela mudar algo, chame de novo sem confirmar. Se houver pendência (tipo ambíguo), pergunte qual e chame de novo com tipo_despesa_id. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.';

/** Entrada (13.4): os campos da despesa, mais `confirmar` e `token_previa`. Sem `usuario_id` (P1). */
export const entrada = z.object({
  tipo: z.string().optional().describe('Tipo da despesa como a pessoa disse, por exemplo "aluguel".'),
  tipo_despesa_id: z.string().optional().describe('Id do tipo, quando a pessoa já escolheu entre as pendências.'),
  valor: z.number().optional().describe('Valor em reais, inteiro, sem centavos.'),
  data: z.string().optional().describe('Data AAAA-MM-DD. Omita para hoje.'),
  descricao: z.string().optional().describe('Descrição curta, só se a pessoa disser.'),
  observacoes: z.string().optional().describe('Observações, só se a pessoa disser.'),
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});
type Entrada = z.infer<typeof entrada>;

/** Uma pendência: o tipo não resolveu sozinho, e a pessoa precisa escolher. */
type Pendencia = { campo: 'tipo_despesa_id'; aviso: string; opcoes: TipoDespesa[] };

/** O que a normalização devolve antes de gravar ou de emitir a prévia. */
type Normalizacao =
  | { ok: true; dados: DespesaNormalizada; nomeDoTipo: string }
  | { ok: false; pendencias: Pendencia[]; erros: ErroDeCampo[] };

/**
 * Normaliza a entrada exatamente como o `salvar_despesa` validaria (13.4: "valida como
 * o salvar_*"). O tipo vem do id escolhido (conferido no catálogo) ou do nome pela
 * 11.15. Ambiguidade vira pendência, nunca escolha automática. A data omitida é hoje
 * em São Paulo. Função pura: as duas chamadas passam por ela, e o HMAC é feito sobre o
 * resultado, então a mesma entrada sempre dá o mesmo token.
 */
export function normalizarFallback(e: Entrada, tipos: TipoDespesa[], hoje: string = hojeEmSaoPaulo()): Normalizacao {
  const pendencias: Pendencia[] = [];
  let tipo: TipoDespesa | undefined;
  const idEscolhido = e.tipo_despesa_id?.trim();
  if (idEscolhido) {
    tipo = tipos.find((t) => t.id === idEscolhido);
  } else {
    const r = resolverTipo(e.tipo, tipos);
    if (r.situacao === 'ok') tipo = r.tipo;
    const aviso = avisoDoTipo(r);
    if (aviso) pendencias.push({ campo: 'tipo_despesa_id', aviso, opcoes: r.situacao === 'ambiguo' ? r.candidatos : tipos });
  }

  const v = validarDespesa({
    tipo_despesa_id: tipo?.id ?? '',
    // Número com casa decimal vira "1450.5" e é recusado pela 11.1, nunca arredondado.
    valor_despesa: e.valor === undefined ? undefined : String(e.valor),
    data_competencia: e.data ?? hoje,
    descricao: e.descricao,
    observacoes: e.observacoes,
  });
  // O erro de tipo não se soma a uma pendência do mesmo campo: a pendência já diz o que falta.
  const errosRestantes = v.ok ? [] : v.erros.filter((x) => !(pendencias.length && x.campo === 'tipo_despesa_id'));
  if (!v.ok || pendencias.length || !tipo) return { ok: false, pendencias, erros: errosRestantes };
  return { ok: true, dados: v.dados, nomeDoTipo: tipo.nome };
}

/** Resultado para o modelo; `isError` quando nada foi gravado por um problema a corrigir. */
function resposta(estrutura: Record<string, unknown>, texto: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text: texto }], structuredContent: estrutura, ...(isError ? { isError } : {}) };
}

/**
 * `registrar_despesa` (13.4). Chamada 1: devolve `previa` (com rótulos em português),
 * `pendencias` e, só se não houver pendência nem erro, o `token_previa`. Chamada 2
 * (`confirmar: true`): recusa com pendência, recalcula o HMAC sobre os dados de agora e
 * só grava se bater e não tiver vencido; dados diferentes dão a mensagem da 13.4.
 */
export async function registrarDespesa(e: Entrada, ctx: ToolContext): Promise<CallToolResult> {
  const tipos = await lerTiposDespesa(ctx);
  if (!tipos) return resposta({ ok: false }, erros.inesperado, true);

  const n = normalizarFallback(e, tipos);
  if (!n.ok) {
    if (e.confirmar && n.pendencias.length) return resposta({ ok: false, pendencias: n.pendencias }, erros.pendenciasAbertas, true);
    return resposta({ ok: false, pendencias: n.pendencias, erros: n.erros }, textosParaOModelo.nadaGravadoComPendencias, true);
  }

  if (!e.confirmar) {
    const previa = {
      tipo: n.nomeDoTipo,
      valor: formatarDinheiro(n.dados.valor_despesa),
      data: formatarData(n.dados.data_competencia),
      descricao: n.dados.descricao,
      observacoes: n.dados.observacoes,
    };
    const token = emitirTokenDePrevia(ctx.config.previewSecret, ctx.sub, ACAO, n.dados);
    return resposta({ ok: true, previa, pendencias: [], token_previa: token }, textosParaOModelo.previaPronta);
  }

  const conferencia = conferirTokenDePrevia(ctx.config.previewSecret, ctx.sub, ACAO, n.dados, e.token_previa);
  if (conferencia === 'divergente') return resposta({ ok: false }, erros.dadosMudaram, true);
  if (conferencia !== 'ok') return resposta({ ok: false }, erros.tokenInvalido, true);

  const r = await gravarDespesa(n.dados, ctx).catch(() => ({ ok: false as const, erros: [{ campo: null, mensagem: erros.inesperado }] }));
  if (!r.ok) return resposta(r, r.erros.map((x) => x.mensagem).join('; '), true);
  return resposta(r, textoParaOModelo(r.resumo, r.ids[0] ?? ''));
}

/**
 * Registra `registrar_despesa` (visível ao modelo) SÓ quando o cliente não mostra MCP
 * Apps (13.4). Quando o cliente não diz se mostra (`desconhecido`, clientes de 2025),
 * registra também, para nunca deixar a pessoa sem caminho.
 */
export function registrarFallbackDespesa(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui === 'sim') return;
  server.registerTool(
    'registrar_despesa',
    { description: DESCRICAO, inputSchema: entrada, _meta: { ui: { visibility: ['model'] } } },
    async (args) => {
      const inicio = performance.now();
      const r = await registrarDespesa(args, ctx);
      logarChamada('registrar_despesa', inicio, !r.isError, ctx.sub);
      return r;
    },
  );
}
