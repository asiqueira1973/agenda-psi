/**
 * Descrições das ferramentas de leitura (13.2), copiadas byte a byte de
 * supabase/functions/agente/ferramentas.ts; test/tools/read.test.ts lê aquele
 * arquivo e falha se divergirem. Única exceção: `buscar_paciente` não cita "observações",
 * porque P5 tira o campo da resposta, e prometê-lo faria o modelo inventar.
 */
export const descricoes = {
  buscar_paciente:
    'Procura pacientes pelo nome (aceita parte do nome, sem acento). Devolve até 5, com o cadastro completo (telefone, e-mail), status, se recebe lembrete por SMS, preço atual de referência, sessões realizadas, sessões não pagas, última sessão, primeira consulta, total pago e TODOS os horários fixos do paciente na agenda semanal (dia da semana, início e fim). Use sempre que a pergunta citar um paciente pelo nome, inclusive "quais os horários do fulano".',
  historico_do_paciente:
    'Histórico de UM paciente: as sessões registradas (data, se pagou, modalidade, duração) e os pagamentos (data de competência, valor, tipo), do mais recente para o mais antigo. Aceita um intervalo de datas opcional. Use para "quando o fulano pagou da última vez?", "quais sessões da fulana em outubro?" ou "quanto o fulano já me pagou este ano?". Se o nome trouxer mais de um paciente, devolve as opções.',
  consultar_despesas:
    'Despesas do consultório num período (aluguel de sala, supervisão, impostos etc.), com o total geral e o total por tipo já calculados. Filtro opcional por tipo (parte do nome, sem acento). Use para "quanto gastei de aluguel este ano?" ou "quais despesas tive em outubro?". Sem período, considera tudo.',
  listar_pacientes:
    'Lista os nomes dos pacientes, com filtros opcionais: status (ativo ou inativo) e se recebe lembrete por SMS. Use para "quantos pacientes ativos eu tenho?", "quem tem aviso de SMS ligado?" ou "quais pacientes estão inativos?".',
  consultar_periodo:
    'Faturamento e gastos de um PERÍODO de vários meses, mês a mês e com o total já somado: recebido, pendente, despesas, saldo (recebido menos despesas) e sessões realizadas. Use para "quanto faturei este ano?", "quanto gastei no semestre?", "como foram os últimos 3 meses?". Para um mês só, use consultar_mes.',
  consultar_mes:
    'Números de um mês: quanto foi recebido, quanto está pendente de pagamentos, e quantas sessões realizadas houve. Use para perguntas como "quanto recebi em outubro?" ou "quantas sessões fiz este mês?".',
  agenda_do_dia:
    'Os horários fixos da agenda semanal num dia: hora de início, hora de fim e paciente, em ordem. A agenda é uma semana-padrão que se repete; não diz se a sessão aconteceu. Use para "qual é a minha agenda de hoje?", "quem eu atendo amanhã?" ou "o que tenho na quinta?".',
  agenda_da_semana:
    'Todos os horários fixos da agenda semanal na semana (segunda a domingo) que contém a data dada, com a data de cada dia. Use para "qual a minha agenda essa semana?" ou "e semana que vem?". Prefira esta a chamar agenda_do_dia sete vezes.',
  listar_pendencias:
    'Lista os pacientes com pagamentos pendentes ou vencidos, com quantidade, total pendente e o vencimento mais antigo, e também os pacientes com sessões marcadas como "não pagou". Use para "quem não pagou?" ou "quem está me devendo?".',
} as const;
