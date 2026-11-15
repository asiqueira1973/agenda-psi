import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { logarChamada } from '../../log.js';
import { dataValida, hojeEmSaoPaulo } from '../../rules/dates.js';
import { mensagensDoApp, textosNovosDespesa, textosParaOModelo } from '../../rules/messages.js';
import { validarValorEmReais } from '../../rules/money.js';
import type { ToolContext } from '../context.js';
import { lerTiposDespesa } from './options.js';
import { avisoDoTipo, resolverTipo } from './resolve-type.js';
import { DESPESA_RESOURCE_URI, MAX_DESCRICAO, type PreenchimentoDaDespesa, type TipoDespesa } from './schema.js';

/**
 * Descrição para o modelo: a do `propor_despesas` do agente, no singular, e a regra
 * 9.2 explícita (fechar sem salvar não grava, e o modelo não pode afirmar que gravou).
 */
export const DESCRICAO =
  'Abre o formulário para registrar UMA despesa do consultório (dinheiro que saiu: aluguel, supervisão, impostos), já preenchido com o que a pessoa disse. Não grava nada: a pessoa confere e clica em Salvar. Se ela fechar o formulário sem salvar, nada foi registrado, e você não deve dizer que registrou. Depois do Salvar, o formulário informa o resumo e o id da despesa.';

/**
 * Entrada (13.3): espelha um item de `propor_despesas`, com tudo opcional. Sem
 * `usuario_id` (P1). A data padrão é hoje em São Paulo (11.3).
 */
export const entrada = z.object({
  tipo: z.string().optional().describe('Tipo da despesa como a pessoa disse, por exemplo "aluguel".'),
  valor: z.number().optional().describe('Valor em reais, inteiro, sem centavos.'),
  data: z.string().optional().describe('Data AAAA-MM-DD. Resolva "hoje", "ontem" a partir da data de hoje. Omita para hoje.'),
  descricao: z.string().optional().describe('Descrição curta, só se a pessoa disser.'),
});

/**
 * Monta o pré-preenchimento (8.2, passo 2). Normaliza sem gravar e sem decidir pela
 * pessoa:
 * - tipo resolvido pela 11.15: um casamento preenche; dois ou mais (ou nenhum) deixam
 *   o campo VAZIO, com os candidatos e um aviso;
 * - valor e data inválidos não são "consertados": o campo fica vazio e vai um aviso;
 * - descrição acima de 200 fica inteira, com aviso (a pessoa decide o que cortar);
 * - data omitida vira hoje em São Paulo (11.3).
 */
export function preencherDespesa(
  args: z.infer<typeof entrada>,
  tipos: TipoDespesa[],
  hoje: string = hojeEmSaoPaulo(),
): PreenchimentoDaDespesa {
  const avisos: string[] = [];

  const tipo = resolverTipo(args.tipo, tipos);
  const aviso = avisoDoTipo(tipo);
  if (aviso) avisos.push(aviso);

  let valor = '';
  if (args.valor !== undefined) {
    const v = validarValorEmReais(args.valor);
    if (v.valido) valor = String(v.valor);
    else avisos.push(mensagensDoApp.valorInvalido);
  }

  let data = hoje;
  if (args.data !== undefined) {
    const d = dataValida(args.data);
    if (d) data = d;
    else {
      data = '';
      avisos.push(textosNovosDespesa.dataInvalida);
    }
  }

  // Como valor e data: não "consertar" em silêncio. Fica inteira e vai o aviso.
  const descricao = (args.descricao ?? '').trim();
  if (descricao.length > MAX_DESCRICAO) avisos.push(textosNovosDespesa.descricaoLonga);

  return {
    campos: {
      tipo_despesa_id: tipo.situacao === 'ok' ? tipo.tipo.id : null,
      valor_despesa: valor,
      data_competencia: data,
      descricao,
      observacoes: '',
    },
    candidatos: tipo.situacao === 'ambiguo' ? tipo.candidatos : [],
    avisos,
  };
}

/**
 * Registra `abrir_formulario_despesa` (13.3), visível ao modelo, ligado ao HTML do
 * formulário pelo `resourceUri` (13.1). O texto devolvido ao modelo diz que nada foi
 * gravado. Se os tipos não carregarem, o formulário abre mesmo assim e tenta de novo.
 */
export function registrarAbrirFormularioDespesa(server: McpServer, ctx: ToolContext): void {
  registerAppTool(
    server,
    'abrir_formulario_despesa',
    {
      title: 'Registrar despesa',
      description: DESCRICAO,
      inputSchema: entrada,
      _meta: { ui: { resourceUri: DESPESA_RESOURCE_URI, visibility: ['model'] } },
    },
    async (args) => {
      const inicio = performance.now();
      const tipos = (await lerTiposDespesa(ctx)) ?? [];
      const preenchimento = preencherDespesa(args, tipos);
      logarChamada('abrir_formulario_despesa', inicio, true, ctx.sub);
      const avisos = preenchimento.avisos.length ? ` Avisos: ${preenchimento.avisos.join('; ')}.` : '';
      return {
        content: [{ type: 'text', text: `${textosParaOModelo.formularioAberto}${avisos}` }],
        structuredContent: preenchimento,
      };
    },
  );
}
