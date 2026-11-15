import * as z from 'zod';
import { diaDaSemanaDoBanco, diasDaSemanaDe } from '../../rules/weekday.js';
import type { ResultadoDeLeitura, ToolContext } from '../context.js';

type Ctx = Pick<ToolContext, 'db' | 'sub'>;

/** Nomes dos dias na ordem do banco: índice 0 = segunda (1) … 6 = domingo (7), pegadinha 7. */
const NOMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export const entradaDia = z.object({
  data: z.string().describe('Data no formato AAAA-MM-DD. Para "hoje", use a data de hoje.'),
});

/**
 * `agenda_do_dia` (13.2), portado do agente: os horários fixos da semana-padrão que caem
 * no dia da data pedida, em ordem. O dia vem de `diaDaSemanaDoBanco` (1 = segunda,
 * 7 = domingo, regra 11.6). Sem ids na resposta.
 */
export async function agendaDoDia(args: z.infer<typeof entradaDia>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const data = args.data ?? '';
  const dia = diaDaSemanaDoBanco(data);
  if (dia === null) return { erro: 'data deve ser AAAA-MM-DD' };

  const { data: horarios, error } = await db
    .from('view_agenda_semana_padrao')
    .select('dia_semana_label, hora_inicio, hora_fim, paciente_nome')
    .eq('usuario_id', sub)
    .eq('dia_semana', dia)
    .order('hora_inicio', { ascending: true });
  if (error) return { erro: 'falha ao ler a agenda' };

  return {
    data,
    dia_da_semana: horarios?.[0]?.dia_semana_label ?? null,
    horarios: (horarios ?? []).map((h) => ({ inicio: h.hora_inicio?.slice(0, 5), fim: h.hora_fim?.slice(0, 5), paciente: h.paciente_nome })),
  };
}

export const entradaSemana = z.object({
  data: z.string().describe('Qualquer data da semana desejada, AAAA-MM-DD.'),
});

/**
 * `agenda_da_semana` (13.2), portado do agente: a semana-padrão inteira (segunda a
 * domingo) que contém a data, agrupada por dia e com a data de cada um.
 */
export async function agendaDaSemana(args: z.infer<typeof entradaSemana>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const datas = diasDaSemanaDe(args.data ?? '');
  if (!datas) return { erro: 'data deve ser AAAA-MM-DD' };

  const { data: horarios, error } = await db
    .from('view_agenda_semana_padrao')
    .select('dia_semana, dia_semana_label, hora_inicio, hora_fim, paciente_nome')
    .eq('usuario_id', sub)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (error) return { erro: 'falha ao ler a agenda' };

  return {
    dias: datas.map((d, i) => ({
      dia: NOMES[i],
      data: d,
      horarios: (horarios ?? [])
        .filter((h) => h.dia_semana === i + 1)
        .map((h) => ({ inicio: h.hora_inicio?.slice(0, 5), fim: h.hora_fim?.slice(0, 5), paciente: h.paciente_nome })),
    })),
  };
}
