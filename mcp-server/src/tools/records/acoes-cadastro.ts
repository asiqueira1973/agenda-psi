import * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { copyAgendaDoApp, copyPacientesDoApp, diasDoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { doAgente, doSpec, horarioDoApp, pacienteDoApp, textosNovosEpico6 } from '../../rules/copy-registros.js';
import { statusDoPaciente } from '../../rules/db-literals.js';
import { formatarDinheiro } from '../../rules/format.js';
import { erros } from '../../rules/messages.js';
import type { ToolContext } from '../context.js';
import { validarPaciente } from '../patient/model.js';
import { inserirHorario, lerAgenda } from '../schedule/index.js';
import { conflitosDoHorario, DIAS_DO_MODELO, diaDoNome, horaValida, resumoDoHorario, validarHorario, type HorarioDaAgenda } from '../schedule/model.js';
import { campoEscolha, campoLeitura, campoMarcar, nadaMudou } from './acoes-financeiras.js';
import { excluirPorId, linhaQueMudou, type DefDeRegistro, type Mudancas } from './motor.js';
import type { Campo, ErroDeRegistro } from './tipos.js';

/**
 * Edição de paciente, troca e remoção de horário (8.6), como `useEditarPaciente`,
 * `useAtualizarPreco` e o cartão do agente do app (criar o novo, depois excluir o antigo).
 * Observações do paciente nunca são lidas nem gravadas (P5, 8.6): o `update` não tem a
 * coluna, então ela fica como está.
 */

const campoPacienteDoModelo = z.string().optional().describe('Nome do paciente como a pessoa disse. O servidor procura no cadastro.');
const achar = (campos: Campo[], nome: string) => campos.find((c) => c.nome === nome);

// ---------------------------------------------------------------------------
// Edição de paciente
// ---------------------------------------------------------------------------

export type Cadastro = { id: string; nome: string; telefone: string; email: string; status: string; receber_sms: boolean; preco: number | null };
type LinhaDoCartao = { paciente_id: string; nome_completo: string | null; telefone: string | null; email: string | null; status: string | null; receber_sms: boolean | null; preco_vigente: number | null };
const COLUNAS_DO_CADASTRO = 'paciente_id, nome_completo, telefone, email, status, receber_sms, preco_vigente';
const cadastroDaLinha = (l: LinhaDoCartao): Cadastro => ({
  id: l.paciente_id, nome: l.nome_completo ?? '', telefone: l.telefone ?? '', email: l.email ?? '', status: l.status ?? 'ativo', receber_sms: l.receber_sms !== false, preco: l.preco_vigente,
});

async function lerCadastro(ctx: ToolContext, id: string): Promise<Cadastro | null> {
  const r = await ctx.db.from('v_pacientes_cartao').select(COLUNAS_DO_CADASTRO).eq('usuario_id', ctx.sub).eq('paciente_id', id).maybeSingle();
  return r.error || !r.data ? null : cadastroDaLinha(r.data as LinhaDoCartao);
}

const texto = (nome: string, rotulo: string, atual: string, pedido: unknown): Campo => ({
  nome, rotulo, tipo: 'texto', atual, atualRotulo: atual || '—', valor: typeof pedido === 'string' ? pedido.trim() : atual,
});

export const edicaoPaciente: DefDeRegistro<Cadastro> = {
  acao: 'edicao_paciente',
  modo: 'edicao',
  qual: 'alteração de cadastro',
  titulo: doAgente.edicaoPaciente,
  descricaoAbrir: 'Abre o formulário para ALTERAR o cadastro de um paciente já cadastrado: nome, telefone, e-mail, se recebe lembrete por SMS, se está ativo ou inativo, e o preço por sessão (vale a partir de hoje). Preencha SÓ os campos que a pessoa pediu para mudar. Observações não passam por aqui. Não grava nada: a pessoa confere o antes e depois e clica em Salvar.',
  descricaoFallback: 'Altera o cadastro de um paciente em duas chamadas, para clientes sem formulário. A primeira devolve a prévia (antes e depois), as pendências e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({
    paciente: campoPacienteDoModelo,
    nome: z.string().optional().describe('Nome completo novo.'),
    telefone: z.string().optional().describe('Telefone novo.'),
    email: z.string().optional().describe('E-mail novo. String vazia para apagar o e-mail.'),
    receber_sms: z.boolean().optional().describe('true liga o lembrete por SMS, false desliga.'),
    status: z.enum(['ativo', 'inativo']).optional(),
    preco: z.number().optional().describe('Preço novo por sessão, em reais. Vale a partir de hoje.'),
  }),
  porPaciente: true,
  ler: async (ctx, id) => {
    if (!id) return [];
    const c = await lerCadastro(ctx, id);
    return c ? [c] : null;
  },
  lerUm: lerCadastro,
  // É o próprio paciente: um só, sempre escolhido.
  casam: (_a, todos) => todos,
  id: (c) => c.id,
  rotulo: (c) => c.nome,
  campos: (c, a) => [
    texto('nome', copyPacientesDoApp.nome, c.nome, a.nome),
    texto('telefone', copyPacientesDoApp.telefone, c.telefone, a.telefone),
    texto('email', copyPacientesDoApp.email, c.email, a.email),
    campoEscolha('status', pacienteDoApp.status, statusDoPaciente, c.status, a.status as string | undefined),
    campoMarcar('receber_sms', copyPacientesDoApp.receberSms, c.receber_sms, a.receber_sms),
    { nome: 'preco', rotulo: copyPacientesDoApp.preco, tipo: 'numero', prefixo: 'R$', rodape: doAgente.avisoDoPreco,
      atual: c.preco === null ? '' : String(c.preco), atualRotulo: c.preco === null ? '—' : formatarDinheiro(c.preco),
      valor: typeof a.preco === 'number' ? String(a.preco) : c.preco === null ? '' : String(c.preco) },
  ],
  validar: (c, v) => {
    const campos = edicaoPaciente.campos(c, {}, null);
    const f = { nome: v.nome ?? c.nome, telefone: v.telefone ?? c.telefone, email: v.email ?? c.email, preco: v.preco ?? (c.preco === null ? '' : String(c.preco)), receber_sms: (v.receber_sms ?? String(c.receber_sms)) === 'true', horarios: [] };
    const status = v.status ?? c.status;
    // Mesmas regras do cadastro (validarNome, validarTelefone, validarEmailOpcional, 11.1).
    const r = validarPaciente(f);
    const e: ErroDeRegistro[] = r.ok ? [] : r.erros;
    if (!statusDoPaciente.some((o) => o.valor === status)) e.push({ campo: 'status', mensagem: erros.inesperado });
    if (!r.ok || e.length) return { ok: false, erros: e };
    const d = r.dados;
    const linhas: Mudancas['linhas'] = [];
    if (d.nome_completo !== c.nome) linhas.push(...linhaQueMudou(achar(campos, 'nome'), d.nome_completo));
    if (d.telefone !== c.telefone) linhas.push(...linhaQueMudou(achar(campos, 'telefone'), d.telefone));
    if ((d.email ?? '') !== c.email) linhas.push(...linhaQueMudou(achar(campos, 'email'), d.email ?? '—'));
    if (status !== c.status) linhas.push(...linhaQueMudou(achar(campos, 'status'), statusDoPaciente.find((o) => o.valor === status)?.rotulo ?? status));
    if (d.receber_sms !== c.receber_sms) linhas.push(...linhaQueMudou(achar(campos, 'receber_sms'), d.receber_sms ? 'sim' : 'não'));
    const cadastroMudou = linhas.length > 0;
    if (d.preco !== c.preco) linhas.push(...linhaQueMudou(achar(campos, 'preco'), formatarDinheiro(d.preco)));
    if (!linhas.length) return nadaMudou();
    return {
      ok: true,
      mudancas: {
        colunas: {
          ...(cadastroMudou ? { cadastro: { nome_completo: d.nome_completo, telefone: d.telefone, email: d.email, status, receber_sms: d.receber_sms } } : {}),
          ...(d.preco !== c.preco ? { preco: d.preco } : {}),
        },
        linhas,
      },
    };
  },
  gravar: async (c, m, ctx) => {
    const { cadastro, preco } = m!.colunas as { cadastro?: Record<string, unknown>; preco?: number };
    if (cadastro) {
      const r = await ctx.db.from('pacientes').update(cadastro as never).eq('id', c.id).eq('usuario_id', ctx.sub).select('id');
      if (r.error) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
      if (!(r.data ?? []).length) return { ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] };
      await enviarEvento(ctx.config, { nome: eventos.pacienteEditado, id: '', distinctId: ctx.email, tela: 'mcp_edicao_paciente', descricao: 'paciente editado' });
    }
    if (preco !== undefined) {
      // Preço é append-only (pegadinha 2, 11.17): linha nova, nunca update.
      const r = await ctx.db.from('precos_paciente').insert({ usuario_id: ctx.sub, paciente_id: c.id, preco });
      // Repetir é seguro: o update do cadastro é idempotente e o preço não entrou.
      if (r.error) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
      await enviarEvento(ctx.config, { nome: eventos.atualizacaoPreco, id: '', distinctId: ctx.email, tela: 'mcp_edicao_paciente', descricao: 'preco atualizado' });
    }
    const nome = (cadastro?.nome_completo as string | undefined) ?? c.nome;
    const outras = m!.linhas.filter((l) => l.campo !== copyPacientesDoApp.preco).map((l) => `${l.campo} ${l.depois}`);
    const resumo = [outras.length ? `${nome}: ${outras.join(', ')}.` : '', preco !== undefined ? pacienteDoApp.sucessoPreco(formatarDinheiro(preco)) : ''].filter(Boolean).join(' ');
    return { ok: true, ids: [c.id], titulo: pacienteDoApp.sucessoAtualizado(nome), resumo };
  },
  vazio: '',
  textos: { salvar: pacienteDoApp.salvar, salvando: pacienteDoApp.salvando, aviso: null },
};

// ---------------------------------------------------------------------------
// Troca e remoção de horário
// ---------------------------------------------------------------------------

export type Horario = { id: string; paciente_id: string; paciente_nome: string; dia_semana: number; hora_inicio: string; hora_fim: string };
type LinhaDoHorario = { id: string | null; paciente_id: string | null; paciente_nome: string | null; dia_semana: number | null; hora_inicio: string | null; hora_fim: string | null };
const COLUNAS_DO_HORARIO = 'id, paciente_id, paciente_nome, dia_semana, hora_inicio, hora_fim';
const horarioDaLinha = (l: LinhaDoHorario): Horario => ({
  id: l.id ?? '', paciente_id: l.paciente_id ?? '', paciente_nome: l.paciente_nome ?? '', dia_semana: l.dia_semana ?? 1, hora_inicio: (l.hora_inicio ?? '').slice(0, 5), hora_fim: (l.hora_fim ?? '').slice(0, 5),
});

async function lerHorarios(ctx: ToolContext, pacienteId: string | null): Promise<Horario[] | null> {
  if (!pacienteId) return [];
  const r = await ctx.db.from('view_agenda_semana_padrao').select(COLUNAS_DO_HORARIO).eq('usuario_id', ctx.sub).eq('paciente_id', pacienteId).order('dia_semana').order('hora_inicio');
  return r.error ? null : ((r.data ?? []) as LinhaDoHorario[]).map(horarioDaLinha);
}

async function lerHorario(ctx: ToolContext, id: string): Promise<Horario | null> {
  const r = await ctx.db.from('view_agenda_semana_padrao').select(COLUNAS_DO_HORARIO).eq('usuario_id', ctx.sub).eq('id', id).maybeSingle();
  return r.error || !r.data ? null : horarioDaLinha(r.data as LinhaDoHorario);
}

const rotuloDoHorario = (h: Horario) => resumoDoHorario('', h);
/** Pelo dia e pela hora de início ditos (agente: `dia_atual`/`hora_atual`, `dia`/`hora`). */
const casaHorario = (chaveDoDia: string, chaveDaHora: string) => (a: Record<string, unknown>, todos: Horario[]) => {
  const dia = diaDoNome(a[chaveDoDia]);
  const hora = horaValida(a[chaveDaHora]);
  return dia || hora ? todos.filter((h) => (!dia || h.dia_semana === dia) && (!hora || h.hora_inicio === hora)) : null;
};
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const DIAS = diasDoApp.map((d) => ({ valor: String(d.valor), rotulo: d.rotulo }));
const diaDoModelo = z.enum(DIAS_DO_MODELO);
const horaDoModelo = z.string().optional();

/** Os valores do formulário como horário, ou `null` se incompletos. */
const horarioDosCampos = (campos: Campo[]) => {
  const v = validarHorario({ dia_semana: achar(campos, 'dia_semana')?.valor, hora_inicio: achar(campos, 'hora_inicio')?.valor, hora_fim: achar(campos, 'hora_fim')?.valor }, '');
  return v.ok ? v.dados : null;
};

export const trocaHorario: DefDeRegistro<Horario> = {
  acao: 'troca_horario',
  modo: 'edicao',
  qual: 'troca de horário',
  titulo: doAgente.trocaHorario,
  descricaoAbrir: 'Abre o formulário para TROCAR um horário fixo da agenda semanal de um paciente já cadastrado: de um dia/hora para outro. Use para "o Tomás passou de quarta às 9h para quarta às 10h" ou "muda a Laura para quinta". Informe o horário atual se a pessoa disser. Não grava nada: a pessoa confere e clica em Salvar.',
  descricaoFallback: 'Troca um horário fixo de um paciente em duas chamadas, para clientes sem formulário. A primeira devolve a prévia (antes e depois, e o aviso se coincidir com outro horário), as pendências e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({
    paciente: campoPacienteDoModelo,
    dia_atual: diaDoModelo.optional().describe('Dia do horário que vai mudar, se a pessoa disser.'),
    hora_atual: horaDoModelo.describe('Hora de início atual, HH:MM, se a pessoa disser.'),
    novo_dia: diaDoModelo.optional().describe('Dia novo. Omita se continuar o mesmo dia.'),
    nova_hora_inicio: horaDoModelo.describe('Hora de início nova, HH:MM. Omita se só mudar o dia.'),
    nova_hora_fim: horaDoModelo.describe('Só se a pessoa disser. Padrão: mantém a duração atual.'),
  }),
  porPaciente: true,
  ler: lerHorarios,
  lerUm: lerHorario,
  casam: casaHorario('dia_atual', 'hora_atual'),
  id: (h) => h.id,
  rotulo: rotuloDoHorario,
  extra: (ctx) => lerAgenda(ctx),
  campos: (h, a) => {
    const novoDia = diaDoNome(a.novo_dia);
    const inicio = horaValida(a.nova_hora_inicio) ?? h.hora_inicio;
    // Fim padrão: mantém a duração atual (agente), sem passar das 23:59.
    const fim = horaValida(a.nova_hora_fim) ?? hora(Math.min(minutos(inicio) + minutos(h.hora_fim) - minutos(h.hora_inicio), 23 * 60 + 59));
    return [
      campoLeitura('atual', doAgente.horarioAtual, rotuloDoHorario(h), doAgente.avisoDaTroca),
      campoEscolha('dia_semana', copyAgendaDoApp.grupoDia, DIAS, String(h.dia_semana), novoDia ? String(novoDia) : undefined),
      { nome: 'hora_inicio', rotulo: copyAgendaDoApp.horaInicio, tipo: 'hora', atual: h.hora_inicio, atualRotulo: h.hora_inicio, valor: inicio },
      { nome: 'hora_fim', rotulo: copyAgendaDoApp.horaFim, tipo: 'hora', atual: h.hora_fim, atualRotulo: h.hora_fim, valor: fim },
    ];
  },
  aviso: (h, campos, extra) => {
    const novo = horarioDosCampos(campos);
    const c = novo ? conflitosDoHorario(novo, (extra as HorarioDaAgenda[] | null) ?? [], h.id) : [];
    return c.length ? textosNovosEpico5.conflito(c) : undefined;
  },
  validar: (h, v) => {
    const r = validarHorario({ dia_semana: v.dia_semana ?? String(h.dia_semana), hora_inicio: v.hora_inicio ?? h.hora_inicio, hora_fim: v.hora_fim ?? h.hora_fim }, '');
    if (!r.ok) return { ok: false, erros: r.erros };
    const n = r.dados;
    if (n.dia_semana === h.dia_semana && n.hora_inicio === h.hora_inicio && n.hora_fim === h.hora_fim) return nadaMudou();
    return { ok: true, mudancas: { colunas: { ...n }, linhas: [{ campo: doAgente.novoHorario, antes: rotuloDoHorario(h), depois: resumoDoHorario('', n) }] } };
  },
  gravar: async (h, m, ctx, continuar) => {
    const n = m!.colunas as { dia_semana: number; hora_inicio: string; hora_fim: string };
    // O novo primeiro, o antigo depois, como o cartão do agente: falhar no meio deixa os
    // dois na agenda (visível e reversível), nunca nenhum.
    const novoId = continuar.novo_id || (await inserirHorario({ ...n, paciente_id: h.paciente_id }, ctx, 'mcp_troca_horario'));
    if (!novoId) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
    const erro = await excluirPorId(ctx, 'agenda_semana_padrao', h.id);
    if (erro) return { ok: false, erros: [{ campo: null, mensagem: doAgente.trocaParcial }], continuar: { novo_id: novoId } };
    return { ok: true, ids: [novoId], titulo: doSpec.horarioAlterado, resumo: `${h.paciente_nome}: ${rotuloDoHorario(h)} para ${resumoDoHorario('', n)}` };
  },
  vazio: textosNovosEpico6.semHorarios,
  textos: { salvar: copyAgendaDoApp.salvar, salvando: copyAgendaDoApp.salvando, aviso: null },
};

export const remocaoHorario: DefDeRegistro<Horario> = {
  ...trocaHorario,
  acao: 'remocao_horario',
  modo: 'exclusao',
  qual: 'remoção de horário',
  titulo: doAgente.remocaoHorario,
  descricaoAbrir: 'Abre o formulário para TIRAR um horário fixo da agenda semanal de um paciente (ele parou de vir naquele horário). Use para "o Tomás parou de vir às quartas". Não apaga o paciente nem as sessões. Nada é apagado sem a pessoa confirmar duas vezes no formulário.',
  descricaoFallback: 'Tira um horário fixo da agenda de um paciente em duas chamadas, para clientes sem formulário. A primeira devolve a prévia, as pendências e um token_previa; nada é apagado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({
    paciente: campoPacienteDoModelo,
    dia: diaDoModelo.optional().describe('Dia do horário a tirar, se a pessoa disser.'),
    hora: horaDoModelo.describe('Hora de início, HH:MM, se a pessoa disser.'),
  }),
  casam: casaHorario('dia', 'hora'),
  extra: undefined,
  aviso: undefined,
  campos: () => [],
  validar: undefined,
  gravar: async (h, _m, ctx) => {
    const erro = await excluirPorId(ctx, 'agenda_semana_padrao', h.id);
    return erro ? { ok: false, erros: [erro] } : { ok: true, ids: [h.id], titulo: horarioDoApp.sucessoExcluido, resumo: `${h.paciente_nome}, ${rotuloDoHorario(h)}` };
  },
  textos: { salvar: doAgente.tirarDaAgenda, salvando: copyAgendaDoApp.salvando, aviso: doAgente.avisoDaRemocao, excluir: doAgente.tirarDaAgenda, confirmar: horarioDoApp.confirmarExclusaoTitulo, definitivo: doSpec.excluirDefinitivamente },
};
