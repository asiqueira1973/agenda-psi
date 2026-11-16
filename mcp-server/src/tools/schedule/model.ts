import { mensagensEpico5DoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { normalizar } from '../../rules/text.js';

/**
 * Modelo e validação de horários fixos (8.5, 13.3; regras 11.6, 11.7, 11.19), puro: o
 * formulário de horário e o de paciente com horários importam daqui (P3).
 */

/** Uma linha de horário como a pessoa vê: dia como texto do número do banco (1–7). */
export type LinhaDeHorario = { paciente_id: string; dia_semana: string; hora_inicio: string; hora_fim: string };

/** Um horário pronto para o insert, igual ao `useCriarAgendamento` do app (P4). */
export type HorarioNormalizado = { dia_semana: number; hora_inicio: string; hora_fim: string };

/** Uma linha da agenda existente, para o aviso de sobreposição. */
export type HorarioDaAgenda = { id?: string | null; paciente_nome?: string | null; dia_semana: number | null; hora_inicio: string | null; hora_fim: string | null };

/** Dias como o agente aceita do modelo; índice + 1 = número do banco (pegadinha 7). */
export const DIAS_DO_MODELO = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;
/** Nomes por extenso, índice 0 = segunda (como `agenda_da_semana`). */
export const NOMES_DOS_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/** Nome do dia ("quarta-feira") no número do banco (3), ou `null` (`diaDoNome` do agente). */
export function diaDoNome(nome: unknown): number | null {
  if (typeof nome !== 'string') return null;
  const i = (DIAS_DO_MODELO as readonly string[]).indexOf(normalizar(nome).replace('-feira', ''));
  return i === -1 ? null : i + 1;
}

/** Hora HH:MM normalizada ("9:00" e "9h" viram "09:00"), ou `null` (`horaValida` do agente). */
export function horaValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2})[:h](\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Fim padrão: 50 minutos depois do início, sem passar de 23:59 (11.7, `horaFimPadrao`). */
export function horaFimPadrao(inicio: string): string {
  const [h, m] = inicio.split(':').map(Number) as [number, number];
  const total = Math.min(h * 60 + m + 50, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Valida um horário (11.6, 11.7, como `validarIntervaloDeHoras` do app): dia 1–7, início e
 * fim em HH:MM, fim depois do início. `prefixo` põe o erro no campo certo da linha.
 */
export function validarHorario(l: Partial<LinhaDeHorario>, prefixo: string):
  { ok: true; dados: HorarioNormalizado } | { ok: false; erros: Array<{ campo: string; mensagem: string }> } {
  const erros: Array<{ campo: string; mensagem: string }> = [];
  const dia = Number(l.dia_semana);
  // Pela tela o dia sempre vem do seletor; só o fallback manda dia inválido. Texto do agente.
  if (!(Number.isInteger(dia) && dia >= 1 && dia <= 7)) erros.push({ campo: `${prefixo}dia_semana`, mensagem: 'dia ou hora inválidos' });
  const inicio = horaValida(l.hora_inicio ?? '');
  const fim = horaValida(l.hora_fim ?? '');
  if (!inicio || !fim) erros.push({ campo: `${prefixo}hora_fim`, mensagem: mensagensEpico5DoApp.horarioIncompleto });
  else if (!(fim > inicio)) erros.push({ campo: `${prefixo}hora_fim`, mensagem: mensagensEpico5DoApp.horaFimAntesDoInicio });
  if (erros.length || !inicio || !fim) return { ok: false, erros };
  return { ok: true, dados: { dia_semana: dia, hora_inicio: inicio, hora_fim: fim } };
}

/**
 * Sobreposição com a agenda (11.19, `conflitosDoHorario` do app): mesmo dia e intervalos
 * que se cruzam. É AVISO, não bloqueio. Devolve "Laura (10:00–10:50)" de cada conflito.
 */
export function conflitosDoHorario(novo: HorarioNormalizado, agenda: HorarioDaAgenda[], ignorarId?: string): string[] {
  return agenda
    .filter((h) => h.id !== ignorarId && h.dia_semana === novo.dia_semana && h.hora_inicio && h.hora_fim)
    .filter((h) => novo.hora_inicio < (h.hora_fim as string).slice(0, 5) && novo.hora_fim > (h.hora_inicio as string).slice(0, 5))
    .map((h) => `${h.paciente_nome ?? 'Outro paciente'} (${(h.hora_inicio as string).slice(0, 5)}–${(h.hora_fim as string).slice(0, 5)})`);
}

/** Aviso de conflito com o texto do app, ou `null`. */
export function avisoDeConflito(novo: HorarioNormalizado, agenda: HorarioDaAgenda[]): string | null {
  const c = conflitosDoHorario(novo, agenda);
  return c.length ? textosNovosEpico5.conflito(c) : null;
}

/** Resumo: "Laura Mendes, Quarta 10:00–10:50". */
export function resumoDoHorario(nome: string, h: HorarioNormalizado): string {
  return `${nome ? `${nome}, ` : ''}${NOMES_DOS_DIAS[h.dia_semana - 1]} ${h.hora_inicio}–${h.hora_fim}`;
}

/** Texto do `updateModelContext` e do fallback (padrão aprovado da despesa). */
export function textoDosHorariosParaOModelo(resumo: string, ids: string[]): string {
  return `${ids.length === 1 ? 'Horário criado' : 'Horários criados'}: ${resumo} (${ids.length === 1 ? 'id' : 'ids'} ${ids.join(', ')}).`;
}
