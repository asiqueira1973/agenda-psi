import type { App } from '@modelcontextprotocol/ext-apps';
import { copyAgendaDoApp, copyPacientesDoApp, copyPagamentosDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { tipoDoPagamento } from '../../src/rules/db-literals.js';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import type { PreenchimentoDePagamentos, RespostaDePagamentos } from '../../src/tools/payment/index.js';
import { textoDosPagamentosParaOModelo, validarPagamentos, type LinhaDePagamento } from '../../src/tools/payment/model.js';
import { $, comBusca, criarFormulario, el, opcoesDePaciente } from '../shared/app.js';
import { estadoInicialDeLinhas, reduzirLinhas, type AcaoDeLinhas, type EstadoDeLinhas } from '../shared/linhas.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';

/**
 * Formulário de pagamentos (8.5, 13.3): um ou vários, cada linha com paciente, valor,
 * mês de competência e tipo (Mensal / Por sessão). Rótulos do app; valores gravados são os
 * literais do banco (11.4). O valor sugerido é o preço de referência do paciente (11.11),
 * com o rodapé do app "Preço atual do paciente.".
 */

type Paciente = { id: string; nome: string; ativo: boolean; preco_referencia: number | null };
let estado: EstadoDeLinhas<LinhaDePagamento> = estadoInicialDeLinhas();
let pacientes: Paciente[] = [];
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();

function despachar(a: AcaoDeLinhas<LinhaDePagamento>): void {
  estado = reduzirLinhas(estado, a);
  desenhar();
}

$('cancelar').textContent = textosNovosDespesa.cancelar;
$('tentar-de-novo').textContent = textosNovosDespesa.tentarDeNovo;
$('carregar-erro-texto').textContent = errosDoServidor.inesperado;
$('cancelado').textContent = textosNovosDespesa.cancelado;

/** Um campo com rótulo acima, erro embaixo e `aria-describedby` (17). */
function campo(id: string, rotulo: string, controle: HTMLElement, rodape?: HTMLElement): HTMLElement {
  controle.id = id;
  controle.setAttribute('aria-describedby', `erro-${id}`);
  return el('div', { className: 'campo' }, el('label', { for: id }, rotulo), controle, ...(rodape ? [rodape] : []), el('p', { className: 'erro', id: `erro-${id}`, hidden: true }));
}

function montarLinhas(): void {
  const raiz = $('linhas');
  raiz.replaceChildren();
  estado.linhas.forEach((_, i) => {
    const paciente = el('select');
    const busca = el('input', { type: 'search', className: 'busca', id: `busca-${i}`, placeholder: copyPacientesDoApp.buscar, 'aria-label': copyPacientesDoApp.buscar });
    busca.addEventListener('input', () => opcoesDePaciente(paciente, pacientes, estado.candidatos[i] ?? [], copyDespesaDoApp.tipoPlaceholder, busca.value, estado.linhas[i]?.paciente_id ?? ''));
    const valor = el('input', { inputMode: 'numeric', placeholder: 'Ex: 200' });
    const data = el('input', { type: 'date' });
    const tipo = el('select');
    for (const o of tipoDoPagamento) tipo.add(new Option(o.rotulo, o.valor));
    const rodape = el('p', { className: 'rodape', id: `rodape-${i}` }, copyPagamentosDoApp.rodapeValor);
    raiz.append(el('div', { className: 'linha' },
      comBusca(campo(`${i}.paciente_id`, copyAgendaDoApp.paciente, paciente), busca, paciente),
      el('div', { className: 'dupla' },
        el('div', { className: 'campo' }, el('label', { for: `${i}.valor_pagamento` }, copyPagamentosDoApp.valor), el('div', { className: 'prefixo' }, el('span', { 'aria-hidden': 'true' }, 'R$'), valor), rodape, el('p', { className: 'erro', id: `erro-${i}.valor_pagamento`, hidden: true })),
        campo(`${i}.data_competencia`, copyPagamentosDoApp.competencia, data)),
      campo(`${i}.tipo`, copyPagamentosDoApp.grupoTipo, tipo),
    ));
    valor.id = `${i}.valor_pagamento`;
    valor.setAttribute('aria-describedby', `erro-${i}.valor_pagamento rodape-${i}`);
    paciente.addEventListener('input', () => {
      despachar({ tipo: 'editar', linha: i, campo: 'paciente_id', valor: paciente.value });
      // Como a tela do app: o preço do paciente escolhido entra quando o valor está vazio
      // ou veio da referência; o que a pessoa digitou não é sobrescrito.
      const l = estado.linhas[i];
      const ref = pacientes.find((p) => p.id === paciente.value)?.preco_referencia;
      if (l && (l.valor_origem !== 'frase' || !l.valor_pagamento) && ref) {
        despachar({ tipo: 'editar', linha: i, campo: 'valor_pagamento', valor: String(ref) });
        despachar({ tipo: 'editar', linha: i, campo: 'valor_origem', valor: 'referencia' });
      }
    });
    valor.addEventListener('input', () => {
      despachar({ tipo: 'editar', linha: i, campo: 'valor_pagamento', valor: valor.value });
      despachar({ tipo: 'editar', linha: i, campo: 'valor_origem', valor: 'frase' });
    });
    data.addEventListener('input', () => despachar({ tipo: 'editar', linha: i, campo: 'data_competencia', valor: data.value }));
    tipo.addEventListener('input', () => despachar({ tipo: 'editar', linha: i, campo: 'tipo', valor: tipo.value }));
  });
}

function desenhar(): void {
  const s = estado;
  document.querySelector('main')!.setAttribute('aria-busy', String(s.fase === 'carregando'));
  const trancado = s.fase !== 'pronto';
  if ($('linhas').children.length !== s.linhas.length) montarLinhas();
  s.linhas.forEach((l, i) => {
    const sel = $<HTMLSelectElement>(`${i}.paciente_id`);
    const busca = $<HTMLInputElement>(`busca-${i}`);
    busca.disabled = trancado;
    if (sel.options.length <= 1 && pacientes.length) opcoesDePaciente(sel, pacientes, s.candidatos[i] ?? [], copyDespesaDoApp.tipoPlaceholder, busca.value, l.paciente_id);
    for (const c of ['paciente_id', 'valor_pagamento', 'data_competencia', 'tipo'] as const) {
      const e = $<HTMLInputElement>(`${i}.${c}`);
      if (e.value !== l[c]) e.value = l[c];
      e.disabled = trancado;
      const erro = s.erros[`${i}.${c}`];
      e.setAttribute('aria-invalid', String(!!erro));
      const p = $(`erro-${i}.${c}`);
      p.textContent = erro ?? '';
      p.hidden = !erro;
    }
    $(`rodape-${i}`).hidden = l.valor_origem !== 'referencia';
  });
  const avisos = $('avisos');
  avisos.replaceChildren(...s.avisos.map((t) => el('p', {}, t)));
  avisos.hidden = !s.avisos.length || s.fase === 'sucesso' || s.fase === 'cancelado';
  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;
  $('carregar-erro').hidden = s.fase !== 'erro_opcoes';
  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = s.fase === 'salvando' ? copyPagamentosDoApp.salvando : copyPagamentosDoApp.salvar;
  salvar.disabled = s.fase !== 'pronto' || !s.linhas.every((l) => l.paciente_id && l.valor_pagamento.trim() && l.data_competencia);
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';
  $('form').hidden = s.fase === 'sucesso' || s.fase === 'cancelado';
  $('cancelado').hidden = s.fase !== 'cancelado';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-titulo').textContent = s.titulo ?? copyPagamentosDoApp.sucessoCriado;
  $('sucesso-resumo').textContent = s.resumo ?? '';
}

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

app = criarFormulario('pagamento', (r) => {
  const dados = r.structuredContent as PreenchimentoDePagamentos | undefined;
  if (!dados?.linhas) return;
  formularioId = dados.formulario_id;
  const lembranca = formularioId ? lerLembranca(storage, formularioId) : null;
  if (lembranca) return despachar({ tipo: 'restaurar', lembranca });
  despachar({ tipo: 'preenchimento', linhas: dados.linhas.map((l) => l.campos), candidatos: dados.linhas.map((l) => l.paciente.candidatos.map((c) => c.id)), avisos: dados.avisos });
}, () => void carregarPacientes());

$('tentar-de-novo').addEventListener('click', () => {
  despachar({ tipo: 'recarregar' });
  void carregarPacientes();
});

$('cancelar').addEventListener('click', () => {
  despachar({ tipo: 'cancelar' });
  if (estado.fase !== 'cancelado') return;
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado('pagamento') }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const v = validarPagamentos(estado.linhas);
  if (!v.ok) return despachar({ tipo: 'erros_locais', erros: v.erros });
  despachar({ tipo: 'salvar_inicio' });
  let r: RespostaDePagamentos;
  try {
    const pagamentos = estado.linhas.map(({ valor_origem: _o, ...l }) => l);
    const res = await app!.callServerTool({ name: 'salvar_pagamentos', arguments: { pagamentos } });
    r = (res.structuredContent as RespostaDePagamentos | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  }
  if (!r.ok) return despachar({ tipo: 'salvar_erro', erros: r.erros, gravadas: r.gravadas, parcial: { ids: r.ids, resumo: r.resumo ?? '', extra: [] } });
  despachar({ tipo: 'salvar_ok', titulo: r.titulo, tituloVarios: textosNovosEpico5.pagamentosRegistrados, resumo: r.resumo, extra: [], ids: r.ids });
  // Depois de falha parcial, o estado soma as tentativas: memória e modelo recebem o total.
  const { resumo, ids, titulo } = estado;
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo: resumo ?? '', idSalvo: ids[0] ?? null, titulo: titulo ?? r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDosPagamentosParaOModelo(resumo ?? '', ids) }] }).catch(() => undefined);
});

desenhar();
