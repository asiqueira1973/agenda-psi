import type { App } from '@modelcontextprotocol/ext-apps';
import { copyAgendaDoApp, copySessoesDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import { modalidadeDaSessao, pagamentoDaSessao } from '../../src/rules/db-literals.js';
import { textoDasSessoesParaOModelo, validarSessoes, type LinhaDeSessao } from '../../src/tools/sessions/model.js';
import type { PreenchimentoDeSessoes, RespostaDeSessoes } from '../../src/tools/sessions/index.js';
import { $, criarFormulario, el, opcoesDePaciente } from '../shared/app.js';
import { estadoInicialDeLinhas, reduzirLinhas, type AcaoDeLinhas, type EstadoDeLinhas } from '../shared/linhas.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';

/**
 * Formulário de sessões (8.5, 13.3): uma ou várias, cada linha com paciente, data,
 * pagamento (Pagou / Não pagou / Mensal), modalidade, duração e "será cobrada". Os rótulos
 * são os do app; os valores gravados são os literais do banco (11.4). Sessão "Pagou" não
 * cria pagamento: depois de salvar, um botão pede ao modelo o formulário de pagamento.
 */

type Paciente = { id: string; nome: string; ativo: boolean };
let estado: EstadoDeLinhas<LinhaDeSessao> = estadoInicialDeLinhas();
let pacientes: Paciente[] = [];
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();

function despachar(a: AcaoDeLinhas<LinhaDeSessao>): void {
  estado = reduzirLinhas(estado, a);
  desenhar();
}

// --- Textos fixos ----------------------------------------------------------------------
$('cancelar').textContent = textosNovosDespesa.cancelar;
$('tentar-de-novo').textContent = textosNovosDespesa.tentarDeNovo;
$('carregar-erro-texto').textContent = errosDoServidor.inesperado;
$('cancelado').textContent = textosNovosDespesa.cancelado;
$('oferta').textContent = textosNovosEpico5.registrarTambemPagamento;

/** Um campo com rótulo acima e erro embaixo, ligado por `aria-describedby` (17). */
function campo(id: string, rotulo: string, controle: HTMLElement): HTMLElement {
  const erro = el('p', { className: 'erro', id: `erro-${id}`, hidden: true });
  controle.id = id;
  controle.setAttribute('aria-describedby', `erro-${id}`);
  return el('div', { className: 'campo', 'data-campo': id }, el('label', { for: id }, rotulo), controle, erro);
}

/** Um `<select>` com os pares valor/rótulo do banco (11.4/11.5). */
function selecao(opcoes: ReadonlyArray<{ valor: string; rotulo: string }>): HTMLSelectElement {
  const s = el('select');
  for (const o of opcoes) s.add(new Option(o.rotulo, o.valor));
  return s;
}

/** Monta os blocos das linhas (uma vez por preenchimento; depois só atualiza valores). */
function montarLinhas(): void {
  const raiz = $('linhas');
  raiz.replaceChildren();
  estado.linhas.forEach((_, i) => {
    const paciente = el('select');
    const data = el('input', { type: 'date' });
    const pagamento = selecao(pagamentoDaSessao);
    const modalidade = selecao(modalidadeDaSessao);
    const duracao = el('input', { inputMode: 'numeric', placeholder: copySessoesDoApp.duracaoPlaceholder });
    const cobrada = el('input', { type: 'checkbox', id: `${i}.devesercobrada` });
    const bloco = el('div', { className: 'linha' },
      campo(`${i}.paciente_id`, copyAgendaDoApp.paciente, paciente),
      el('div', { className: 'dupla' }, campo(`${i}.ocorreu_em_dia`, copySessoesDoApp.data, data), campo(`${i}.duracao_minutos`, copySessoesDoApp.duracao, duracao)),
      el('div', { className: 'dupla' }, campo(`${i}.pagamento`, copySessoesDoApp.grupoPagamento, pagamento), campo(`${i}.modalidade`, copySessoesDoApp.grupoModalidade, modalidade)),
      el('label', { className: 'marcar', for: `${i}.devesercobrada` }, cobrada, copySessoesDoApp.seraCobrada),
    );
    raiz.append(bloco);
    const ligar = (c: keyof LinhaDeSessao, e: HTMLInputElement | HTMLSelectElement) => e.addEventListener('input', () => {
      despachar({ tipo: 'editar', linha: i, campo: c, valor: (c === 'devesercobrada' ? (e as HTMLInputElement).checked : e.value) as never });
    });
    ligar('paciente_id', paciente); ligar('ocorreu_em_dia', data); ligar('pagamento', pagamento);
    ligar('modalidade', modalidade); ligar('duracao_minutos', duracao); ligar('devesercobrada', cobrada);
  });
}

function desenhar(): void {
  const s = estado;
  document.querySelector('main')!.setAttribute('aria-busy', String(s.fase === 'carregando'));
  const trancado = s.fase !== 'pronto';
  if ($('linhas').children.length !== s.linhas.length) montarLinhas();
  s.linhas.forEach((l, i) => {
    const sel = $<HTMLSelectElement>(`${i}.paciente_id`);
    if (sel.options.length <= 1 && pacientes.length) opcoesDePaciente(sel, pacientes, s.candidatos[i] ?? [], copyDespesaDoApp.tipoPlaceholder);
    for (const c of ['paciente_id', 'ocorreu_em_dia', 'pagamento', 'modalidade', 'duracao_minutos'] as const) {
      const e = $<HTMLInputElement>(`${i}.${c}`);
      if (e.value !== l[c]) e.value = l[c];
      e.disabled = trancado;
      const erro = s.erros[`${i}.${c}`];
      e.setAttribute('aria-invalid', String(!!erro));
      const p = $(`erro-${i}.${c}`);
      p.textContent = erro ?? '';
      p.hidden = !erro;
    }
    const cob = $<HTMLInputElement>(`${i}.devesercobrada`);
    cob.checked = l.devesercobrada;
    cob.disabled = trancado;
  });
  const avisos = $('avisos');
  avisos.replaceChildren(...s.avisos.map((t) => el('p', {}, t)));
  avisos.hidden = !s.avisos.length || s.fase === 'sucesso' || s.fase === 'cancelado';
  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;
  $('carregar-erro').hidden = s.fase !== 'erro_opcoes';
  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = s.fase === 'salvando' ? copySessoesDoApp.salvando : copySessoesDoApp.salvar;
  salvar.disabled = s.fase !== 'pronto' || !s.linhas.every((l) => l.paciente_id && l.ocorreu_em_dia);
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';
  $('form').hidden = s.fase === 'sucesso' || s.fase === 'cancelado';
  $('cancelado').hidden = s.fase !== 'cancelado';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-titulo').textContent = s.titulo ?? copySessoesDoApp.sucessoCriada;
  $('sucesso-resumo').textContent = s.resumo ?? '';
  $('oferta').hidden = !(s.fase === 'sucesso' && s.extra.length);
}

/** Carrega os pacientes para os seletores (`buscar_pacientes_opcoes`). */
async function carregarPacientes(): Promise<void> {
  try {
    const r = await app!.callServerTool({ name: 'buscar_pacientes_opcoes', arguments: {} });
    const lista = (r.structuredContent as { pacientes?: Paciente[] } | undefined)?.pacientes;
    if (r.isError || !lista) return despachar({ tipo: 'opcoes_erro' });
    pacientes = lista;
    $('linhas').replaceChildren();
    despachar({ tipo: 'opcoes_ok' });
  } catch {
    despachar({ tipo: 'opcoes_erro' });
  }
}

app = criarFormulario('sessões', (r) => {
  const dados = r.structuredContent as PreenchimentoDeSessoes | undefined;
  if (!dados?.linhas) return;
  formularioId = dados.formulario_id;
  const lembranca = formularioId ? lerLembranca(storage, formularioId) : null;
  if (lembranca) return despachar({ tipo: 'restaurar', lembranca });
  despachar({
    tipo: 'preenchimento',
    linhas: dados.linhas.map((l) => l.campos),
    candidatos: dados.linhas.map((l) => l.paciente.candidatos.map((c) => c.id)),
    avisos: dados.avisos,
  });
}, () => void carregarPacientes());

$('tentar-de-novo').addEventListener('click', () => {
  despachar({ tipo: 'recarregar' });
  void carregarPacientes();
});

$('cancelar').addEventListener('click', () => {
  despachar({ tipo: 'cancelar' });
  if (estado.fase !== 'cancelado') return;
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado('sessões') }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('oferta').addEventListener('click', () => {
  // Sessão paga não cria pagamento (11.18): a pessoa pede, e o modelo abre o formulário
  // de pagamento já preenchido com o preço de referência (ofertaDePagamento do app).
  void app?.sendMessage({ role: 'user', content: [{ type: 'text', text: textosNovosEpico5.pedidoDePagamento(estado.extra) }] }).catch(() => undefined);
  $<HTMLButtonElement>('oferta').disabled = true;
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const v = validarSessoes(estado.linhas);
  if (!v.ok) return despachar({ tipo: 'erros_locais', erros: v.erros });
  despachar({ tipo: 'salvar_inicio' });
  let r: RespostaDeSessoes;
  try {
    const res = await app!.callServerTool({ name: 'salvar_sessoes', arguments: { sessoes: estado.linhas } });
    r = (res.structuredContent as RespostaDeSessoes | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  }
  if (!r.ok) return despachar({ tipo: 'salvar_erro', erros: r.erros, gravadas: r.gravadas });
  despachar({ tipo: 'salvar_ok', titulo: r.titulo, resumo: r.resumo, extra: r.pagas });
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo: r.resumo, idSalvo: r.ids[0] ?? null, titulo: r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDasSessoesParaOModelo(r.resumo, r.ids) }] }).catch(() => undefined);
});

desenhar();
