import type { App } from '@modelcontextprotocol/ext-apps';
import { copyAgendaDoApp, copyPacientesDoApp, diasDoApp, sucessoHorarioDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import type { PreenchimentoDeHorarios, RespostaDeHorarios } from '../../src/tools/schedule/index.js';
import { avisoDeConflito, horaFimPadrao, horaValida, textoDosHorariosParaOModelo, validarHorario, type HorarioDaAgenda, type LinhaDeHorario } from '../../src/tools/schedule/model.js';
import { $, comBusca, criarFormulario, el, opcoesDePaciente } from '../shared/app.js';
import { estadoInicialDeLinhas, reduzirLinhas, type AcaoDeLinhas, type EstadoDeLinhas } from '../shared/linhas.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';

/**
 * Formulário de horário fixo (8.5, 13.3): paciente, dia da semana (ordem visual começando no
 * domingo, valor 1–7 do banco, pegadinha 7), hora início e hora fim. Sobreposição com outro
 * horário aparece como AVISO embaixo da linha, nunca bloqueia (11.19).
 */

type Paciente = { id: string; nome: string; ativo: boolean };
let estado: EstadoDeLinhas<LinhaDeHorario> = estadoInicialDeLinhas();
let pacientes: Paciente[] = [];
let agenda: HorarioDaAgenda[] = [];
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();
// Começo do texto de sobreposição, para separar esses avisos dos de paciente.
const PREFIXO_CONFLITO = textosNovosEpico5.conflito([]).slice(0, -1);

function despachar(a: AcaoDeLinhas<LinhaDeHorario>): void {
  estado = reduzirLinhas(estado, a);
  desenhar();
}

$('cancelar').textContent = textosNovosDespesa.cancelar;
$('tentar-de-novo').textContent = textosNovosDespesa.tentarDeNovo;
$('carregar-erro-texto').textContent = errosDoServidor.inesperado;
$('cancelado').textContent = textosNovosDespesa.cancelado;

function campo(id: string, rotulo: string, controle: HTMLElement): HTMLElement {
  controle.id = id;
  controle.setAttribute('aria-describedby', `erro-${id}`);
  return el('div', { className: 'campo' }, el('label', { for: id }, rotulo), controle, el('p', { className: 'erro', id: `erro-${id}`, hidden: true }));
}

function montarLinhas(): void {
  const raiz = $('linhas');
  raiz.replaceChildren();
  estado.linhas.forEach((_, i) => {
    const paciente = el('select');
    const busca = el('input', { type: 'search', className: 'busca', id: `busca-${i}`, placeholder: copyPacientesDoApp.buscar, 'aria-label': copyPacientesDoApp.buscar });
    busca.addEventListener('input', () => opcoesDePaciente(paciente, pacientes, estado.candidatos[i] ?? [], copyDespesaDoApp.tipoPlaceholder, busca.value, estado.linhas[i]?.paciente_id ?? ''));
    const dia = el('select');
    // Dia não dito fica vazio: a pessoa escolhe (nunca vira segunda sem ela dizer).
    dia.add(new Option(copyDespesaDoApp.tipoPlaceholder, ''));
    for (const d of diasDoApp) dia.add(new Option(d.rotulo, String(d.valor)));
    const inicio = el('input', { type: 'time' });
    const fim = el('input', { type: 'time' });
    raiz.append(el('div', { className: 'linha' },
      comBusca(campo(`${i}.paciente_id`, copyAgendaDoApp.paciente, paciente), busca, paciente),
      campo(`${i}.dia_semana`, copyAgendaDoApp.grupoDia, dia),
      el('div', { className: 'dupla' }, campo(`${i}.hora_inicio`, copyAgendaDoApp.horaInicio, inicio), campo(`${i}.hora_fim`, copyAgendaDoApp.horaFim, fim)),
      el('p', { className: 'aviso-linha', id: `conflito-${i}`, role: 'status', hidden: true }),
    ));
    inicio.addEventListener('input', () => {
      // Como o app (11.7): fim acompanha o início com +50 min enquanto a pessoa não mexeu nele.
      const l = estado.linhas[i];
      const antes = l && horaValida(l.hora_inicio);
      const v = horaValida(inicio.value);
      if (l && v && (!l.hora_fim || (antes && l.hora_fim === horaFimPadrao(antes)))) {
        despachar({ tipo: 'editar', linha: i, campo: 'hora_inicio', valor: inicio.value });
        despachar({ tipo: 'editar', linha: i, campo: 'hora_fim', valor: horaFimPadrao(v) });
      }
    });
    for (const [c, e] of [['paciente_id', paciente], ['dia_semana', dia], ['hora_inicio', inicio], ['hora_fim', fim]] as const) {
      e.addEventListener('input', () => despachar({ tipo: 'editar', linha: i, campo: c, valor: e.value }));
    }
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
    for (const c of ['paciente_id', 'dia_semana', 'hora_inicio', 'hora_fim'] as const) {
      const e = $<HTMLInputElement>(`${i}.${c}`);
      if (e.value !== l[c]) e.value = l[c];
      e.disabled = trancado;
      const erro = s.erros[`${i}.${c}`];
      e.setAttribute('aria-invalid', String(!!erro));
      const p = $(`erro-${i}.${c}`);
      p.textContent = erro ?? '';
      p.hidden = !erro;
    }
    // Aviso de sobreposição recalculado a cada edição (11.19): informa, não bloqueia.
    const v = validarHorario(l, '');
    const aviso = v.ok ? avisoDeConflito(v.dados, agenda) : null;
    const p = $(`conflito-${i}`);
    p.textContent = aviso ?? '';
    p.hidden = !aviso || s.fase !== 'pronto';
  });
  const avisos = $('avisos');
  // Só os avisos de paciente; os de sobreposição já aparecem em cada linha.
  const deTopo = s.avisos.filter((a) => !a.startsWith(PREFIXO_CONFLITO));
  avisos.replaceChildren(...deTopo.map((t) => el('p', {}, t)));
  avisos.hidden = !deTopo.length || s.fase === 'sucesso' || s.fase === 'cancelado';
  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;
  $('carregar-erro').hidden = s.fase !== 'erro_opcoes';
  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = s.fase === 'salvando' ? copyAgendaDoApp.salvando : copyAgendaDoApp.salvar;
  salvar.disabled = s.fase !== 'pronto' || !s.linhas.every((l) => l.paciente_id && l.dia_semana && l.hora_inicio && l.hora_fim);
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';
  $('form').hidden = s.fase === 'sucesso' || s.fase === 'cancelado';
  $('cancelado').hidden = s.fase !== 'cancelado';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-titulo').textContent = s.titulo ?? sucessoHorarioDoApp;
  $('sucesso-resumo').textContent = s.resumo ?? '';
}

async function carregarOpcoes(): Promise<void> {
  try {
    const [rp, ra] = await Promise.all([
      app!.callServerTool({ name: 'buscar_pacientes_opcoes', arguments: {} }),
      app!.callServerTool({ name: 'listar_agenda', arguments: {} }),
    ]);
    const lista = (rp.structuredContent as { pacientes?: Paciente[] } | undefined)?.pacientes;
    if (rp.isError || !lista) return despachar({ tipo: 'opcoes_erro' });
    pacientes = lista;
    // Sem a agenda, o formulário funciona; só não avisa sobreposição.
    agenda = (ra.structuredContent as { agenda?: HorarioDaAgenda[] } | undefined)?.agenda ?? [];
    $('linhas').replaceChildren();
    despachar({ tipo: 'opcoes_ok' });
  } catch {
    despachar({ tipo: 'opcoes_erro' });
  }
}

app = criarFormulario('horário', (r) => {
  const dados = r.structuredContent as PreenchimentoDeHorarios | undefined;
  if (!dados?.linhas) return;
  formularioId = dados.formulario_id;
  const lembranca = formularioId ? lerLembranca(storage, formularioId) : null;
  if (lembranca) return despachar({ tipo: 'restaurar', lembranca });
  despachar({ tipo: 'preenchimento', linhas: dados.linhas.map((l) => l.campos), candidatos: dados.linhas.map((l) => l.paciente.candidatos.map((c) => c.id)), avisos: dados.avisos });
}, () => void carregarOpcoes());

$('tentar-de-novo').addEventListener('click', () => {
  despachar({ tipo: 'recarregar' });
  void carregarOpcoes();
});

$('cancelar').addEventListener('click', () => {
  despachar({ tipo: 'cancelar' });
  if (estado.fase !== 'cancelado') return;
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado('horário') }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  despachar({ tipo: 'salvar_inicio' });
  let r: RespostaDeHorarios;
  try {
    const res = await app!.callServerTool({ name: 'salvar_horarios', arguments: { horarios: estado.linhas } });
    r = (res.structuredContent as RespostaDeHorarios | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], gravadas: [], ids: [] };
  }
  if (!r.ok) return despachar({ tipo: 'salvar_erro', erros: r.erros, gravadas: r.gravadas, parcial: { ids: r.ids, resumo: r.resumo ?? '', extra: [] } });
  despachar({ tipo: 'salvar_ok', titulo: r.titulo, tituloVarios: textosNovosEpico5.horariosCriados, resumo: r.resumo, extra: [], ids: r.ids });
  // Depois de falha parcial, o estado soma as tentativas: memória e modelo recebem o total.
  const { resumo, ids, titulo } = estado;
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo: resumo ?? '', idSalvo: ids[0] ?? null, titulo: titulo ?? r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDosHorariosParaOModelo(resumo ?? '', ids) }] }).catch(() => undefined);
});

desenhar();
