import type { App } from '@modelcontextprotocol/ext-apps';
import { categoriasDoFeedbackDoApp, copyFeedbackDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import type { PreenchimentoDeFeedback, RespostaDeFeedback } from '../../src/tools/feedback/index.js';
import { MENSAGEM_MAXIMA, textoDoFeedbackParaOModelo, validarFeedback } from '../../src/tools/feedback/model.js';
import { $, criarFormulario } from '../shared/app.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';

/**
 * Formulário de feedback (8.5, 11.21): categoria e mensagem, com os textos do cartão do
 * agente e da tela de Ajustes do app. Enviar fica desabilitado com a mensagem vazia (8.10).
 */

type Fase = 'carregando' | 'pronto' | 'salvando' | 'sucesso' | 'cancelado';
let fase: Fase = 'carregando';
let erroMensagem: string | null = null;
let erroGeral: string | null = null;
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();

const categoria = $<HTMLSelectElement>('categoria');
const mensagem = $<HTMLTextAreaElement>('mensagem');
for (const c of categoriasDoFeedbackDoApp) categoria.add(new Option(c.rotulo, c.valor));
$('rotulo-categoria').textContent = copyFeedbackDoApp.titulo;
$('rotulo-mensagem').textContent = copyFeedbackDoApp.mensagem;
$('rodape-mensagem').textContent = copyFeedbackDoApp.aviso;
mensagem.placeholder = copyFeedbackDoApp.placeholder;
mensagem.maxLength = MENSAGEM_MAXIMA;
$('cancelar').textContent = textosNovosDespesa.cancelar;
$('cancelado').textContent = textosNovosDespesa.cancelado;

function desenhar(): void {
  document.querySelector('main')!.setAttribute('aria-busy', String(fase === 'carregando'));
  const trancado = fase !== 'pronto';
  categoria.disabled = trancado;
  mensagem.disabled = trancado;
  mensagem.setAttribute('aria-invalid', String(!!erroMensagem));
  const e = $('erro-mensagem');
  e.textContent = erroMensagem ?? '';
  e.hidden = !erroMensagem;
  const g = $('erro-geral');
  g.textContent = erroGeral ?? '';
  g.hidden = !erroGeral;
  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = fase === 'salvando' ? copyFeedbackDoApp.enviando : copyFeedbackDoApp.enviar;
  salvar.disabled = fase !== 'pronto' || !mensagem.value.trim();
  $<HTMLButtonElement>('cancelar').disabled = fase === 'salvando';
  $('form').hidden = fase === 'sucesso' || fase === 'cancelado';
  $('cancelado').hidden = fase !== 'cancelado';
  $('sucesso').hidden = fase !== 'sucesso';
  $('sucesso-titulo').textContent = copyFeedbackDoApp.sucesso;
}

mensagem.addEventListener('input', () => {
  erroMensagem = null;
  erroGeral = null;
  desenhar();
});

app = criarFormulario('feedback', (r) => {
  const dados = r.structuredContent as PreenchimentoDeFeedback | undefined;
  if (!dados?.campos) return;
  formularioId = dados.formulario_id;
  const l = formularioId ? lerLembranca(storage, formularioId) : null;
  if (l) fase = l.fase;
  else {
    categoria.value = dados.campos.categoria;
    mensagem.value = dados.campos.mensagem;
    fase = 'pronto';
  }
  desenhar();
}, () => undefined);

$('cancelar').addEventListener('click', () => {
  if (fase === 'salvando') return;
  fase = 'cancelado';
  desenhar();
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado('feedback') }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (fase !== 'pronto') return;
  const v = validarFeedback({ categoria: categoria.value, mensagem: mensagem.value });
  if (!v.ok) {
    erroMensagem = v.erros[0]?.mensagem ?? null;
    return desenhar();
  }
  fase = 'salvando';
  desenhar();
  let r: RespostaDeFeedback;
  try {
    const res = await app!.callServerTool({ name: 'salvar_feedback', arguments: { feedback: v.dados } });
    r = (res.structuredContent as RespostaDeFeedback | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], ids: [] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], ids: [] };
  }
  if (!r.ok) {
    fase = 'pronto';
    erroMensagem = r.erros.find((e) => e.campo === 'mensagem')?.mensagem ?? null;
    erroGeral = r.erros.filter((e) => e.campo !== 'mensagem').map((e) => e.mensagem).join(' ') || null;
    return desenhar();
  }
  fase = 'sucesso';
  desenhar();
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo: '', idSalvo: r.ids[0] ?? null, titulo: r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDoFeedbackParaOModelo(r.ids[0] ?? '') }] }).catch(() => undefined);
});

desenhar();
