/**
 * De que hora a que hora a grade da Agenda precisa ir.
 *
 * O handoff desenhou a grade de 08:00 às 21:00 (tela 6), e para a maioria dos
 * dias é isso mesmo. Mas o app NÃO limita o horário que se pode cadastrar: o
 * seletor aceita qualquer hora, e o banco guarda qualquer hora.
 *
 * Enquanto a grade foi fixa em 8–21, um agendamento às 07:00 era gravado com
 * sucesso e desenhado em lugar nenhum — ele entrava na lista do dia (por isso o
 * estado vazio também não aparecia), mas não havia linha onde coubesse. A
 * pessoa via uma grade vazia e concluía que o cadastro tinha falhado.
 *
 * Em 06/10/2026, quando isso foi relatado, havia 19 agendamentos reais nessa
 * situação, o mais cedo às 06:00.
 *
 * Esta função resolve mantendo o desenho do handoff como PISO, não como teto: a
 * grade continua indo de 8 às 21 quando tudo cabe ali, e estica só o necessário
 * quando não cabe. Aumentar a faixa fixa para 6–23 não resolveria — moveria o
 * precipício para as 5:00 e deixaria quatro linhas vazias em todo dia normal.
 *
 * @param blocos a hora cheia de cada agendamento do dia (`hora_bloco` da view)
 * @returns primeira e última hora a desenhar, inclusive
 */
export function faixaDeHorasDaGrade(
  blocos: readonly (number | null)[],
  horaInicialPadrao: number,
  horaFinalPadrao: number,
): { primeira: number; ultima: number } {
  // Nulo não é zero: `hora_bloco` nulo significa dado incompleto, não meia-noite.
  // Incluí-lo esticaria a grade da meia-noite para baixo sem haver o que mostrar.
  const validos = blocos.filter((h): h is number => typeof h === 'number');

  return {
    primeira: Math.min(horaInicialPadrao, ...validos),
    ultima: Math.max(horaFinalPadrao, ...validos),
  };
}

/** As horas a desenhar, da primeira à última, inclusive. */
export function horasDaGrade(
  blocos: readonly (number | null)[],
  horaInicialPadrao: number,
  horaFinalPadrao: number,
): number[] {
  const { primeira, ultima } = faixaDeHorasDaGrade(blocos, horaInicialPadrao, horaFinalPadrao);
  return Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
}
