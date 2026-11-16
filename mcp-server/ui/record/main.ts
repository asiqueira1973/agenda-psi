import type { App } from '@modelcontextprotocol/ext-apps';
import { copyAgendaDoApp, copyPacientesDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { doAgente } from '../../src/rules/copy-registros.js';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import { textoDoRegistroParaOModelo } from '../../src/tools/records/texto.js';
import type { Campo, Candidato, PreenchimentoDeRegistro, RespostaDeRegistro } from '../../src/tools/records/tipos.js';
import { $, comBusca, criarFormulario, el, opcoesDePaciente } from '../shared/app.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';
import { candidatoEscolhido, estadoInicialDeRegistro, reduzirRegistro, type AcaoDeRegistro, type EstadoDeRegistro } from './state.js';

/**
 * Formulário genérico das edições e exclusões (épico 6, 8.6). O servidor manda a lista de
 * campos de cada registro candidato; esta tela só desenha: rótulo acima, valor, "Antes: …"
 * quando o valor mudou, rodapé e erro embaixo (17). Campos `leitura` (data da sessão,
 * competência) aparecem como texto. Exclusão pede o segundo clique "Excluir definitivamente".
 */

type Paciente = { id: string; nome: string; ativo: boolean };
let estado: EstadoDeRegistro = estadoInicialDeRegistro();
let pacientes: Paciente[] = [];
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();
/** Assinatura do que está desenhado, para só remontar campos quando o registro muda. */
let montado = '';

function despachar(a: AcaoDeRegistro): void {
  estado = reduzirRegistro(estado, a);
  desenhar();
}

$('cancelar').textContent = textosNovosDespesa.cancelar;
$('cancelado').textContent = textosNovosDespesa.cancelado;

/** Seletor de paciente, quando a frase não resolveu um só (11.14). */
function montarPaciente(d: PreenchimentoDeRegistro): void {
  const raiz = $('paciente');
  if (!d.paciente || d.paciente.paciente_id) return;
  const select = el('select', { id: 'paciente_id' });
  const busca = el('input', { type: 'search', className: 'busca', placeholder: copyPacientesDoApp.buscar, 'aria-label': copyPacientesDoApp.buscar });
  const desenharOpcoes = () => opcoesDePaciente(select, pacientes, d.paciente?.candidatos.map((c) => c.id) ?? [], copyDespesaDoApp.tipoPlaceholder, busca.value, estado.pacienteId);
  busca.addEventListener('input', desenharOpcoes);
  select.addEventListener('input', () => {
    despachar({ tipo: 'paciente', pacienteId: select.value });
    if (select.value) void carregarCandidatos(select.value);
  });
  raiz.replaceChildren(comBusca(el('div', { className: 'campo' }, el('label', { for: 'paciente_id' }, copyAgendaDoApp.paciente), select), busca, select));
  raiz.hidden = false;
  void app?.callServerTool({ name: 'buscar_pacientes_opcoes', arguments: {} }).then((r) => {
    pacientes = (r.structuredContent as { pacientes?: Paciente[] } | undefined)?.pacientes ?? [];
    desenharOpcoes();
  }, () => undefined);
}

async function carregarCandidatos(pacienteId: string): Promise<void> {
  const d = estado.dados;
  if (!d) return;
  try {
    const r = await app!.callServerTool({ name: 'listar_registros', arguments: { acao: d.acao, paciente_id: pacienteId, pedido: d.pedido } });
    const c = r.structuredContent as { candidatos?: Candidato[]; escolhido?: string | null } | undefined;
    if (r.isError || !c?.candidatos) return despachar({ tipo: 'candidatos_erro', mensagem: errosDoServidor.inesperado });
    despachar({ tipo: 'candidatos', candidatos: c.candidatos, escolhido: c.escolhido ?? null });
  } catch {
    despachar({ tipo: 'candidatos_erro', mensagem: errosDoServidor.inesperado });
  }
}

/** Lista de registros para escolher (até 6), quando a frase casou com mais de um. */
function montarRegistros(): void {
  const raiz = $('registros');
  const cs = estado.candidatos;
  raiz.hidden = cs.length < 2;
  if (cs.length < 2) return raiz.replaceChildren();
  raiz.replaceChildren(el('legend', {}, doAgente.registro), ...cs.map((c) => {
    const r = el('input', { type: 'radio', name: 'registro', value: c.id, id: `registro-${c.id}` });
    r.addEventListener('change', () => despachar({ tipo: 'escolher', id: c.id }));
    return el('label', { for: `registro-${c.id}` }, r, c.rotulo);
  }));
}

function controleDe(c: Campo): HTMLElement {
  if (c.tipo === 'leitura') return el('p', { className: 'leitura', id: c.nome }, c.valor);
  if (c.tipo === 'escolha') {
    const s = el('select');
    for (const o of c.opcoes ?? []) s.add(new Option(o.rotulo, o.valor));
    return s;
  }
  if (c.tipo === 'marcar') return el('input', { type: 'checkbox' });
  if (c.tipo === 'hora') return el('input', { type: 'time' });
  return el('input', c.tipo === 'numero' ? { inputMode: 'numeric' } : {});
}

/** Os campos do registro escolhido (edição) ou o resumo dele (exclusão). */
function montarCampos(c: Candidato | null): void {
  const raiz = $('campos');
  if (!c) return void (raiz.hidden = true);
  raiz.hidden = false;
  if (estado.dados?.modo === 'exclusao') {
    raiz.replaceChildren(el('p', { className: 'leitura' }, c.rotulo), ...(estado.dados.textos.aviso ? [el('p', { className: 'rodape' }, estado.dados.textos.aviso)] : []));
    return;
  }
  raiz.replaceChildren(...c.campos.map((campo) => {
    const controle = controleDe(campo);
    const descricoes = [`erro-${campo.nome}`, `antes-${campo.nome}`, ...(campo.rodape ? [`rodape-${campo.nome}`] : [])];
    controle.id = campo.nome;
    controle.setAttribute('aria-describedby', descricoes.join(' '));
    if (controle instanceof HTMLInputElement || controle instanceof HTMLSelectElement) {
      const ler = () => (controle instanceof HTMLInputElement && controle.type === 'checkbox' ? String(controle.checked) : controle.value);
      controle.addEventListener(controle instanceof HTMLInputElement && controle.type === 'checkbox' ? 'change' : 'input', () => despachar({ tipo: 'editar', campo: campo.nome, valor: ler() }));
    }
    const corpo = campo.prefixo ? el('div', { className: 'prefixo' }, el('span', { 'aria-hidden': 'true' }, campo.prefixo), controle) : controle;
    const rotulo = campo.tipo === 'marcar'
      ? el('label', { className: 'marcar', for: campo.nome }, controle, campo.rotulo)
      : el('label', campo.tipo === 'leitura' ? {} : { for: campo.nome }, campo.rotulo);
    return el('div', { className: 'campo' },
      rotulo,
      ...(campo.tipo === 'marcar' ? [] : [corpo]),
      el('p', { className: 'antes', id: `antes-${campo.nome}`, hidden: true }),
      ...(campo.rodape ? [el('p', { className: 'rodape', id: `rodape-${campo.nome}` }, campo.rodape)] : []),
      el('p', { className: 'erro', id: `erro-${campo.nome}`, hidden: true }));
  }));
}

function desenhar(): void {
  const s = estado;
  const d = s.dados;
  document.querySelector('main')!.setAttribute('aria-busy', String(s.fase === 'carregando' || s.carregando));
  if (!d) return;
  $('titulo').textContent = d.titulo;
  const c = candidatoEscolhido(s);
  const assinatura = `${s.candidatos.map((x) => x.id).join(',')}|${c?.id ?? ''}`;
  if (assinatura !== montado) {
    montado = assinatura;
    montarRegistros();
    montarCampos(c);
  }
  const trancado = s.fase !== 'pronto';
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name=registro]')) {
    r.checked = r.value === s.escolhido;
    r.disabled = s.fase === 'salvando' || s.fase === 'sucesso';
  }
  if (c && d.modo === 'edicao') {
    const v = s.valores[c.id] ?? {};
    for (const campo of c.campos) {
      if (campo.tipo === 'leitura') continue;
      const e = $<HTMLInputElement>(campo.nome);
      const valor = v[campo.nome] ?? campo.valor;
      if (e.type === 'checkbox') e.checked = valor === 'true';
      else if (e.value !== valor) e.value = valor;
      e.disabled = trancado;
      const erro = s.erros[campo.nome];
      e.setAttribute('aria-invalid', String(!!erro));
      const pe = $(`erro-${campo.nome}`);
      pe.textContent = erro ?? '';
      pe.hidden = !erro;
      // Antes e depois (8.6). Caixa de marcar não tem texto de valor no app: sem "Antes".
      const antes = $(`antes-${campo.nome}`);
      antes.textContent = doAgente.antes(campo.atualRotulo);
      antes.hidden = campo.tipo === 'marcar' || valor === campo.atual;
    }
  }
  const avisos = [...d.avisos, ...(c?.aviso ? [c.aviso] : [])];
  $('avisos').replaceChildren(...avisos.map((t) => el('p', {}, t)));
  $('avisos').hidden = !avisos.length || s.fase === 'sucesso' || s.fase === 'cancelado';
  const precisaPaciente = !!d.paciente && !s.pacienteId;
  $('vazio').textContent = d.vazio;
  $('vazio').hidden = precisaPaciente || s.carregando || s.candidatos.length > 0 || !d.vazio;
  $('confirmar').textContent = d.textos.confirmar ?? '';
  $('confirmar').hidden = s.fase !== 'confirmando';
  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;
  const salvar = $<HTMLButtonElement>('salvar');
  const exclusao = d.modo === 'exclusao';
  salvar.textContent = s.fase === 'salvando' ? d.textos.salvando : exclusao && s.fase === 'confirmando' ? (d.textos.definitivo ?? d.textos.salvar) : exclusao ? (d.textos.excluir ?? d.textos.salvar) : d.textos.salvar;
  salvar.classList.toggle('perigo', exclusao && s.fase === 'confirmando');
  salvar.disabled = !c || !(s.fase === 'pronto' || s.fase === 'confirmando');
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';
  $('form').hidden = s.fase === 'sucesso' || s.fase === 'cancelado';
  $('cancelado').hidden = s.fase !== 'cancelado';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-titulo').textContent = s.titulo ?? '';
  $('sucesso-resumo').textContent = s.resumo ?? '';
}

app = criarFormulario('registro', (r) => {
  const dados = r.structuredContent as PreenchimentoDeRegistro | undefined;
  if (!dados?.ferramentaSalvar) return;
  formularioId = dados.formulario_id;
  estado = reduzirRegistro(estado, { tipo: 'preenchimento', dados });
  const l = formularioId ? lerLembranca(storage, formularioId) : null;
  if (l) return despachar({ tipo: 'restaurar', lembranca: l });
  montarPaciente(dados);
  desenhar();
}, () => undefined);

$('cancelar').addEventListener('click', () => {
  // Na confirmação, Cancelar volta um passo; fora dela, cancela o formulário.
  if (estado.fase === 'confirmando') return despachar({ tipo: 'escolher', id: estado.escolhido ?? '' });
  despachar({ tipo: 'cancelar' });
  if (estado.fase !== 'cancelado') return;
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  const qual = estado.dados?.qual ?? '';
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado(qual) }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const d = estado.dados;
  const c = candidatoEscolhido(estado);
  if (!d || !c) return;
  // Exclusão: o primeiro clique só pede a confirmação (8.6).
  if (d.modo === 'exclusao' && estado.fase === 'pronto') return despachar({ tipo: 'pedir_confirmacao' });
  despachar({ tipo: 'salvar_inicio' });
  if (estado.fase !== 'salvando') return;
  let r: RespostaDeRegistro;
  try {
    const res = await app!.callServerTool({ name: d.ferramentaSalvar, arguments: { id: c.id, valores: estado.valores[c.id] ?? {}, continuar: estado.continuar } });
    r = (res.structuredContent as RespostaDeRegistro | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }] };
  }
  if (!r.ok) return despachar({ tipo: 'salvar_erro', erros: r.erros, ...(r.continuar ? { continuar: r.continuar } : {}) });
  despachar({ tipo: 'salvar_ok', titulo: r.titulo, resumo: r.resumo });
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo: r.resumo, idSalvo: r.ids[0] ?? null, titulo: r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDoRegistroParaOModelo(`${r.titulo} ${r.resumo}`, r.ids) }] }).catch(() => undefined);
});

desenhar();
