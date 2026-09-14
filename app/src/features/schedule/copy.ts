/**
 * Textos da agenda.
 *
 * A copy do alerta de exclusão segue o handoff (tela 8a), e não a 15.4:
 * decisão de 13/09/2026, caso a caso. O texto do handoff avisa que o lembrete
 * por SMS daquele dia deixa de ser enviado — informação que o da 15.4 não traz,
 * e que é a consequência real da exclusão.
 */
export const copyAgenda = {
  titulo: 'Agenda',
  adicionar: 'Adicionar horário',

  /** Literal da 15.5, com o dia interpolado. */
  diaVazio: (dia: string) => `Nenhum horário fixo em ${dia}.`,
  /** Do handoff, tela 6a. */
  diaVazioCorpo: 'O horário fixo é o que dispara o lembrete por SMS antes da sessão.',

  /** Mostrado na grade quando o limite de SMS do mês estourou (regra 11.5). */
  smsPausado: 'SMS pausado',
  ate: (hora: string) => `até ${hora}`,

  novo: {
    titulo: 'Novo agendamento',
    paciente: 'Paciente',
    pacienteFolha: 'Escolha o paciente',
    horaInicio: 'Hora início',
    horaFim: 'Hora fim',
    grupoDia: 'Dia da semana',
    grupoNotas: 'Notas',
    salvar: 'Salvar',
    salvando: 'Salvando...',
    /** Aviso, não bloqueio: dois pacientes no mesmo horário é raro mas possível. */
    jaExisteNesseHorario: 'Já existe um horário marcado nesse dia e nessa hora.',
  },

  detalhe: {
    titulo: 'Detalhe do agendamento',
    paciente: 'Paciente',
    dia: 'Dia',
    horario: 'Horário',
    grupoNotas: 'Notas',
    salvar: 'Salvar',
    salvando: 'Salvando...',
    excluir: 'Excluir horário',
    /** Do handoff, tela 8. */
    rodape: 'Para alterar o dia ou a hora, exclua este horário e crie um novo.',
  },

  sucessoCriado: 'Horário criado.',
  sucessoAtualizado: 'Notas salvas.',
  sucessoExcluido: 'Horário excluído.',

  /** Do handoff, tela 8a. Vence a 15.4 porque explica a consequência. */
  confirmarExclusaoTitulo: 'Excluir este horário?',
  confirmarExclusaoCorpo: (dia: string, hora: string) =>
    `O lembrete por SMS de ${dia}, ${hora}, deixa de ser enviado. Não dá para desfazer.`,
} as const;

/**
 * Ordem dos dias no segmented, começando no DOMINGO, como o handoff desenha.
 *
 * Os valores são os do banco, onde 1 é segunda e 7 é domingo (regra 11.4). A
 * ordem visual e a numeração do banco são coisas diferentes, e é exatamente
 * essa diferença que produz o defeito 11.9.4 quando alguém confunde as duas.
 */
export const diasDoSegmented = [
  { valor: 7, rotulo: 'Dom' },
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
] as const;

/** Faixa de horas da grade: 08:00 às 21:00 (handoff, tela 6). */
export const HORA_INICIAL_DA_GRADE = 8;
export const HORA_FINAL_DA_GRADE = 21;
