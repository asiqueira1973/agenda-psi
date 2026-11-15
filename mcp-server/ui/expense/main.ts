import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import type { PreenchimentoDaDespesa, RespostaDoSalvar, TipoDespesa } from '../../src/tools/expense/model.js';
import { textoParaOModelo } from '../../src/tools/expense/validate.js';
import { errosLocais, estadoInicial, podeSalvar, reduzir, type Acao, type Estado, type NomeDoCampo } from './state.js';

/**
 * Formulário de despesa (8.2), em TypeScript puro, sem React (assunção 24.2).
 *
 * Fluxo: handlers registrados ANTES de `app.connect()` (8.2, passo 3) → o resultado de
 * `abrir_formulario_despesa` pré-preenche → `listar_tipos_despesa` carrega as opções →
 * Salvar chama `salvar_despesa` → no sucesso, `updateModelContext` com o resumo e o id
 * (passo 6). O formulário não acessa a rede: tudo passa por `callServerTool` (13.1).
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const CAMPOS: NomeDoCampo[] = ['tipo_despesa_id', 'valor_despesa', 'data_competencia', 'descricao', 'observacoes'];
const ROTULOS: Record<NomeDoCampo, string> = {
  tipo_despesa_id: copyDespesaDoApp.tipoFolha,
  valor_despesa: copyDespesaDoApp.valor,
  data_competencia: copyDespesaDoApp.data,
  descricao: copyDespesaDoApp.descricao,
  observacoes: copyDespesaDoApp.observacoes,
};

let estado: Estado = estadoInicial();

/** Aplica uma ação e redesenha. Toda mudança de tela passa por aqui. */
function despachar(a: Acao): void {
  estado = reduzir(estado, a);
  desenhar();
}

// --- Textos fixos, todos da copy (seção 15) ----------------------------------------
for (const c of CAMPOS) document.querySelector<HTMLLabelElement>(`label[for="${c}"]`)!.textContent = ROTULOS[c];
$<HTMLInputElement>('descricao').placeholder = copyDespesaDoApp.descricaoPlaceholder;
$('cancelar').textContent = textosNovosDespesa.cancelar;
$('tentar-de-novo').textContent = textosNovosDespesa.tentarDeNovo;
$('carregar-erro-texto').textContent = textosNovosDespesa.erroAoCarregarTipos;
$('sucesso-titulo').textContent = copyDespesaDoApp.sucessoCriada;

/** Monta a lista de tipos: vazia no começo, com os candidatos (11.15) em primeiro. */
function desenharTipos(tipos: TipoDespesa[], candidatos: string[], escolhido: string): void {
  const select = $<HTMLSelectElement>('tipo_despesa_id');
  const assinatura = JSON.stringify([tipos, candidatos]);
  if (select.dataset.assinatura !== assinatura) {
    select.replaceChildren(new Option(copyDespesaDoApp.tipoPlaceholder, ''));
    const ordenados = [...tipos.filter((t) => candidatos.includes(t.id)), ...tipos.filter((t) => !candidatos.includes(t.id))];
    for (const t of ordenados) select.add(new Option(t.nome, t.id));
    select.dataset.assinatura = assinatura;
  }
  select.value = escolhido;
}

/** Redesenha a tela inteira a partir do estado. */
function desenhar(): void {
  const s = estado;
  const main = document.querySelector('main')!;
  main.setAttribute('aria-busy', String(s.fase === 'carregando'));
  const trancado = s.fase !== 'pronto';

  desenharTipos(s.tipos, s.candidatos, s.campos.tipo_despesa_id);
  for (const c of CAMPOS) {
    const el = $<HTMLInputElement>(c);
    if (c !== 'tipo_despesa_id' && el.value !== s.campos[c]) el.value = s.campos[c];
    el.disabled = trancado;
    const erro = s.erros[c];
    el.setAttribute('aria-invalid', String(!!erro));
    const p = $(`erro-${c}`);
    p.textContent = erro ?? '';
    p.hidden = !erro;
  }

  const avisos = $('avisos');
  avisos.replaceChildren(...s.avisos.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  avisos.hidden = s.avisos.length === 0 || s.fase === 'sucesso';

  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;

  $('carregar-erro').hidden = s.fase !== 'erro_opcoes';

  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = s.fase === 'salvando' ? copyDespesaDoApp.salvando : copyDespesaDoApp.salvar;
  salvar.disabled = !podeSalvar(s);
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';

  $('form').hidden = s.fase === 'sucesso';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-resumo').textContent = s.resumo ?? '';
}

// --- Ponte com o host ----------------------------------------------------------------
const app = new App({ name: 'Agenda Psi — despesa', version: '0.2.0' });

/** Aplica o tema do host (16): claro/escuro, variáveis e fontes. */
function aplicarTema(ctx: McpUiHostContext | undefined): void {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

/** Carrega as opções do campo tipo (8.2, passo 3). Falha vira o estado `erro_opcoes`. */
async function carregarTipos(): Promise<void> {
  try {
    const r = await app.callServerTool({ name: 'listar_tipos_despesa', arguments: {} });
    const tipos = (r.structuredContent as { tipos?: TipoDespesa[] } | undefined)?.tipos;
    despachar(!r.isError && tipos ? { tipo: 'opcoes_ok', tipos } : { tipo: 'opcoes_erro' });
  } catch {
    despachar({ tipo: 'opcoes_erro' });
  }
}

// Handlers ANTES do connect (8.2, passo 3): o resultado da ferramenta chega uma vez só.
app.ontoolresult = (resultado) => {
  const dados = resultado.structuredContent as PreenchimentoDaDespesa | undefined;
  if (dados?.campos) despachar({ tipo: 'preenchimento', dados });
};
app.onhostcontextchanged = aplicarTema;
app.onteardown = async () => ({});

// --- Interação -------------------------------------------------------------------------
for (const c of CAMPOS) {
  $(c).addEventListener('input', (ev) => {
    despachar({ tipo: 'editar', campo: c, valor: (ev.target as HTMLInputElement).value });
  });
}

$('tentar-de-novo').addEventListener('click', () => {
  despachar({ tipo: 'recarregar' });
  void carregarTipos();
});

$('cancelar').addEventListener('click', () => {
  // Fechar sem salvar não grava nada (9.2); o host decide como fechar a visualização.
  void app.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!podeSalvar(estado)) return;
  // A tela valida antes por conveniência; o servidor revalida tudo (P3).
  const locais = errosLocais(estado);
  if (locais.length) {
    despachar({ tipo: 'erros_locais', erros: locais });
    return;
  }
  despachar({ tipo: 'salvar_inicio' });
  let resposta: RespostaDoSalvar;
  try {
    const r = await app.callServerTool({ name: 'salvar_despesa', arguments: { ...estado.campos } });
    resposta = (r.structuredContent as RespostaDoSalvar | undefined)
      ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }] };
  } catch {
    // Erro de rede vira a mensagem geral, sem stack (8.2, passo 7).
    resposta = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }] };
  }
  despachar({ tipo: 'salvar_fim', resposta });
  if (resposta.ok && resposta.ids[0]) {
    // O modelo passa a saber o que foi gravado, sem a pessoa repetir (8.2, passo 6).
    void app.updateModelContext({ content: [{ type: 'text', text: textoParaOModelo(resposta.resumo, resposta.ids[0]) }] })
      .catch(() => undefined);
  }
});

desenhar();
app.connect().then(() => {
  aplicarTema(app.getHostContext());
  void carregarTipos();
});
