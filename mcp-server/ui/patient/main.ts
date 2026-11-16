import type { App } from '@modelcontextprotocol/ext-apps';
import { copyAgendaDoApp, copyPacientesDoApp, diasDoApp, horarioDoPacienteNovoDoApp, textosNovosEpico5 } from '../../src/rules/copy-app.js';
import { copyDespesaDoApp, erros as errosDoServidor, textosNovosDespesa } from '../../src/rules/messages.js';
import type { PreenchimentoDePaciente, RespostaDePaciente } from '../../src/tools/patient/index.js';
import { textoDoPacienteParaOModelo, validarPaciente, type FormularioDePaciente } from '../../src/tools/patient/model.js';
import { avisoDeConflito, horaFimPadrao, horaValida, validarHorario, type HorarioDaAgenda } from '../../src/tools/schedule/model.js';
import { $, criarFormulario, el } from '../shared/app.js';
import { lembrar, lerLembranca, storageDaPagina } from '../shared/memoria.js';

/**
 * Formulário "Novo paciente" (8.5, 13.3): rótulos da tela do app, mais os horários fixos
 * que a frase pediu (rótulo "Horário na agenda" do cartão do agente). Sem observações (P5).
 *
 * Depois que o paciente existe, o formulário TRANCA: se o preço ou um horário falharam,
 * mostra o que faltou e não oferece salvar de novo, para não duplicar o paciente.
 */

type Fase = 'carregando' | 'pronto' | 'salvando' | 'sucesso' | 'cancelado';
type Estado = {
  fase: Fase;
  campos: FormularioDePaciente;
  erros: Record<string, string>;
  erroGeral: string | null;
  titulo: string | null;
  resumo: string | null;
  avisosFinais: string[];
};

let estado: Estado = {
  fase: 'carregando',
  campos: { nome: '', telefone: '', email: '', preco: '', receber_sms: true, horarios: [] },
  erros: {}, erroGeral: null, titulo: null, resumo: null, avisosFinais: [],
};
let agenda: HorarioDaAgenda[] = [];
let formularioId: string | undefined;
let app: App | undefined;
const storage = storageDaPagina();

function mudar(p: Partial<Estado>): void {
  estado = { ...estado, ...p };
  desenhar();
}

function editar<K extends keyof FormularioDePaciente>(campo: K, valor: FormularioDePaciente[K]): void {
  const { [campo]: _limpo, ...erros } = estado.erros;
  mudar({ campos: { ...estado.campos, [campo]: valor }, erros, erroGeral: null });
}

function editarHorario(i: number, campo: 'dia_semana' | 'hora_inicio' | 'hora_fim', valor: string): void {
  const horarios = estado.campos.horarios.map((h, k) => {
    if (k !== i) return h;
    const novo = { ...h, [campo]: valor };
    // Como o app (11.7): o fim acompanha o início com +50 min enquanto a pessoa não mexeu nele.
    const antes = horaValida(h.hora_inicio);
    const agora = horaValida(valor);
    if (campo === 'hora_inicio' && agora && (!h.hora_fim || (antes && h.hora_fim === horaFimPadrao(antes)))) novo.hora_fim = horaFimPadrao(agora);
    return novo;
  });
  const erros = Object.fromEntries(Object.entries(estado.erros).filter(([k]) => !k.startsWith(`horarios.${i}.`)));
  mudar({ campos: { ...estado.campos, horarios }, erros, erroGeral: null });
}

$('cancelar').textContent = textosNovosDespesa.cancelar;
$('cancelado').textContent = textosNovosDespesa.cancelado;

function campo(id: string, rotulo: string, controle: HTMLElement, rodape?: HTMLElement): HTMLElement {
  controle.id = id;
  controle.setAttribute('aria-describedby', rodape ? `erro-${id} ${rodape.id}` : `erro-${id}`);
  return el('div', { className: 'campo' }, el('label', { for: id }, rotulo), controle, ...(rodape ? [rodape] : []), el('p', { className: 'erro', id: `erro-${id}`, hidden: true }));
}

/** Monta os campos uma vez; `desenhar` só sincroniza valores, erros e trancas. */
function montar(): void {
  const nome = el('input', { autocomplete: 'off' });
  const telefone = el('input', { type: 'tel', autocomplete: 'off' });
  const email = el('input', { type: 'email', autocomplete: 'off' });
  const preco = el('input', { inputMode: 'numeric', placeholder: 'Ex: 200' });
  const sms = el('input', { type: 'checkbox', id: 'receber_sms' });
  const rodape = el('p', { className: 'rodape', id: 'rodape-preco' }, copyPacientesDoApp.rodapePreco);
  const campoPreco = el('div', { className: 'campo' }, el('label', { for: 'preco' }, copyPacientesDoApp.preco), el('div', { className: 'prefixo' }, el('span', { 'aria-hidden': 'true' }, 'R$'), preco), rodape, el('p', { className: 'erro', id: 'erro-preco', hidden: true }));
  preco.id = 'preco';
  preco.setAttribute('aria-describedby', 'erro-preco rodape-preco');
  $('campos').replaceChildren(
    campo('nome', copyPacientesDoApp.nome, nome),
    campo('telefone', copyPacientesDoApp.telefone, telefone),
    campo('email', copyPacientesDoApp.email, email),
    campoPreco,
    el('label', { className: 'marcar', for: 'receber_sms' }, sms, copyPacientesDoApp.receberSms),
  );
  for (const [c, e] of [['nome', nome], ['telefone', telefone], ['email', email], ['preco', preco]] as const) {
    e.addEventListener('input', () => editar(c, e.value));
  }
  sms.addEventListener('change', () => editar('receber_sms', sms.checked));

  $('linhas').replaceChildren(...estado.campos.horarios.map((_, i) => {
    const dia = el('select');
    // Dia não dito fica vazio: a pessoa escolhe (nunca vira segunda sem ela dizer).
    dia.add(new Option(copyDespesaDoApp.tipoPlaceholder, ''));
    for (const d of diasDoApp) dia.add(new Option(d.rotulo, String(d.valor)));
    const inicio = el('input', { type: 'time' });
    const fim = el('input', { type: 'time' });
    dia.addEventListener('input', () => editarHorario(i, 'dia_semana', dia.value));
    inicio.addEventListener('input', () => editarHorario(i, 'hora_inicio', inicio.value));
    fim.addEventListener('input', () => editarHorario(i, 'hora_fim', fim.value));
    return el('div', { className: 'linha' },
      el('h3', {}, horarioDoPacienteNovoDoApp),
      campo(`horarios.${i}.dia_semana`, copyAgendaDoApp.grupoDia, dia),
      el('div', { className: 'dupla' }, campo(`horarios.${i}.hora_inicio`, copyAgendaDoApp.horaInicio, inicio), campo(`horarios.${i}.hora_fim`, copyAgendaDoApp.horaFim, fim)),
      el('p', { className: 'aviso-linha', id: `conflito-${i}`, role: 'status', hidden: true }));
  }));
}

function sincronizar(id: string, valor: string, trancado: boolean): void {
  const e = $<HTMLInputElement>(id);
  if (e.value !== valor) e.value = valor;
  e.disabled = trancado;
  const erro = estado.erros[id];
  e.setAttribute('aria-invalid', String(!!erro));
  const p = $(`erro-${id}`);
  p.textContent = erro ?? '';
  p.hidden = !erro;
}

function desenhar(): void {
  const s = estado;
  document.querySelector('main')!.setAttribute('aria-busy', String(s.fase === 'carregando'));
  if (s.fase !== 'carregando' && !$('campos').children.length) montar();
  const trancado = s.fase !== 'pronto';
  if ($('campos').children.length) {
    for (const c of ['nome', 'telefone', 'email', 'preco'] as const) sincronizar(c, s.campos[c], trancado);
    const sms = $<HTMLInputElement>('receber_sms');
    sms.checked = s.campos.receber_sms;
    sms.disabled = trancado;
    s.campos.horarios.forEach((h, i) => {
      for (const c of ['dia_semana', 'hora_inicio', 'hora_fim'] as const) sincronizar(`horarios.${i}.${c}`, h[c], trancado);
      // Sobreposição é aviso, não bloqueio (11.19).
      const v = validarHorario(h, '');
      const aviso = v.ok ? avisoDeConflito(v.dados, agenda) : null;
      const p = $(`conflito-${i}`);
      p.textContent = aviso ?? '';
      p.hidden = !aviso || s.fase !== 'pronto';
    });
  }
  const geral = $('erro-geral');
  geral.textContent = s.erroGeral ?? '';
  geral.hidden = !s.erroGeral;
  const salvar = $<HTMLButtonElement>('salvar');
  salvar.textContent = s.fase === 'salvando' ? copyPacientesDoApp.salvando : copyPacientesDoApp.salvar;
  salvar.disabled = s.fase !== 'pronto' || !s.campos.nome.trim() || !s.campos.telefone.trim() || !s.campos.preco.trim() || s.campos.horarios.some((h) => !h.dia_semana);
  $<HTMLButtonElement>('cancelar').disabled = s.fase === 'salvando';
  $('form').hidden = s.fase === 'sucesso' || s.fase === 'cancelado';
  $('cancelado').hidden = s.fase !== 'cancelado';
  $('sucesso').hidden = s.fase !== 'sucesso';
  $('sucesso-titulo').textContent = s.titulo ?? '';
  $('sucesso-resumo').textContent = s.resumo ?? '';
  // O que ficou de fora depois de o paciente existir: avisa, sem botão de tentar de novo.
  const avisos = $('avisos');
  avisos.replaceChildren(...s.avisosFinais.map((t) => el('p', {}, t)));
  avisos.hidden = !s.avisosFinais.length;
  if (s.fase === 'sucesso' && s.avisosFinais.length) $('sucesso').append(avisos);
}

async function carregarAgenda(): Promise<void> {
  // Só para o aviso de sobreposição: se falhar, o cadastro segue sem o aviso.
  try {
    const r = await app!.callServerTool({ name: 'listar_agenda', arguments: {} });
    agenda = (r.structuredContent as { agenda?: HorarioDaAgenda[] } | undefined)?.agenda ?? [];
    desenhar();
  } catch {
    // segue sem aviso
  }
}

app = criarFormulario('paciente', (r) => {
  const dados = r.structuredContent as PreenchimentoDePaciente | undefined;
  if (!dados?.campos) return;
  formularioId = dados.formulario_id;
  const l = formularioId ? lerLembranca(storage, formularioId) : null;
  if (l?.fase === 'cancelado') return mudar({ fase: 'cancelado' });
  if (l?.fase === 'sucesso') return mudar({ fase: 'sucesso', resumo: l.resumo, titulo: l.titulo ?? null });
  mudar({ fase: 'pronto', campos: dados.campos });
}, () => void carregarAgenda());

$('cancelar').addEventListener('click', () => {
  if (estado.fase === 'salvando') return;
  mudar({ fase: 'cancelado' });
  if (formularioId) lembrar(storage, formularioId, { fase: 'cancelado' });
  void app?.updateModelContext({ content: [{ type: 'text', text: textosNovosEpico5.formularioCancelado('paciente') }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
});

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (estado.fase !== 'pronto') return;
  const v = validarPaciente(estado.campos);
  if (!v.ok) return mudar({ erros: Object.fromEntries(v.erros.map((e) => [e.campo, e.mensagem])) });
  mudar({ fase: 'salvando', erroGeral: null });
  let r: RespostaDePaciente;
  try {
    const res = await app!.callServerTool({ name: 'salvar_paciente', arguments: { paciente: estado.campos } });
    r = (res.structuredContent as RespostaDePaciente | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], ids: [] };
  } catch {
    r = { ok: false, erros: [{ campo: null, mensagem: errosDoServidor.inesperado }], ids: [] };
  }
  if (!r.ok) {
    const porCampo = Object.fromEntries(r.erros.filter((e) => e.campo).map((e) => [e.campo as string, e.mensagem]));
    const geral = r.erros.filter((e) => !e.campo).map((e) => e.mensagem).join(' ') || null;
    return mudar({ fase: 'pronto', erros: porCampo, erroGeral: geral });
  }
  mudar({ fase: 'sucesso', titulo: r.titulo, resumo: r.resumo, avisosFinais: r.avisos });
  const resumo = r.avisos.length ? `${r.resumo}. ${r.avisos.join(' ')}` : r.resumo;
  if (formularioId) lembrar(storage, formularioId, { fase: 'sucesso', resumo, idSalvo: r.ids[0] ?? null, titulo: r.titulo });
  void app?.updateModelContext({ content: [{ type: 'text', text: textoDoPacienteParaOModelo(r.resumo, r.ids[0] ?? '', r.avisos) }] }).catch(() => undefined);
});

desenhar();
