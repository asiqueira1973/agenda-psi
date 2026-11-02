/**
 * Catálogo de eventos de analytics.
 *
 * Os cinco primeiros nomes são os que o app FlutterFlow já manda para o Visão
 * do Produto hoje, copiados byte a byte do código Dart. Não os reescreva: mudar
 * um nome aqui parte a série histórica em duas e o gráfico do produto passa a
 * mentir por omissão (spec 21 e risco 23.9).
 *
 * Uma exceção, decidida por Alexandre em 13/09/2026: o app atual manda
 * `agenda_psi_nova despesa`, com um espaço no meio, destoando dos outros
 * quatro. Esse evento NUNCA disparou — não aparece no catálogo do Visão do
 * Produto, o que confirma o defeito 11.9.5: o tipo da despesa começa em
 * `Option 1`, o insert falha contra uma coluna NOT NULL, e o app mostra
 * "Despesa cadastrada" assim mesmo. Sem série histórica para preservar, o nome
 * foi corrigido para `agenda_psi_novadespesa`.
 *
 * Os demais são novos. Seguem o padrão dos consistentes: prefixo `agenda_psi_`,
 * sem espaço.
 *
 * PostHog sai da jogada (decisão de 13/09/2026): os nomes `psi_*` citados na
 * seção 21 eram os dele. Com a saída, `atualizacao_preco`,
 * `perguntou_assistente` e `screen_view_detalhe_agendamento` deixam de existir
 * como estavam e voltam aqui com o prefixo novo.
 */
export const eventos = {
  // --- Os quatro com série histórica. Não mexer. ---
  novoPaciente: 'agenda_psi_novopaciente',
  novaSessao: 'agenda_psi_novasessao',
  novoPagamento: 'agenda_psi_novopagamento',
  novoAgendamento: 'agenda_psi_novoagendamento',
  // Corrigido: o original tinha um espaço e nunca chegou a registrar nada.
  novaDespesa: 'agenda_psi_novadespesa',

  // --- Novos: existiam só no PostHog. ---
  atualizacaoPreco: 'agenda_psi_atualizacao_preco',
  perguntouAssistente: 'agenda_psi_perguntou_assistente',

  // --- Novos: o funil de cadastro, que ninguém media. ---
  contaCriada: 'agenda_psi_conta_criada',
  senhaRecuperada: 'agenda_psi_senha_recuperada',
  pacienteEditado: 'agenda_psi_paciente_editado',

  // --- Novos: o paywall (spec 21). ---
  paywallVisto: 'agenda_psi_paywall_visto',
  paywallIniciouCompra: 'agenda_psi_paywall_iniciou_compra',
  paywallComprou: 'agenda_psi_paywall_comprou',
  paywallRestaurou: 'agenda_psi_paywall_restaurou',
  limiteSmsAviso: 'agenda_psi_limite_sms_aviso',
  limiteSmsAtingido: 'agenda_psi_limite_sms_atingido',
} as const;

export type NomeDeEvento = (typeof eventos)[keyof typeof eventos];

/**
 * Propriedades que um evento pode carregar.
 *
 * A lista é fechada de propósito. A regra de 20.4 é que NENHUM evento leva nome
 * de paciente, valor, observação ou qualquer texto digitado pelo usuário — e a
 * maneira de garantir isso não é lembrar da regra na hora de chamar, é não ter
 * onde colocar. Por isso não existe `Record<string, string>` aqui.
 *
 * O defeito 11.9.18 é exatamente isso acontecendo no app atual: o texto integral
 * do comando do Agente Psi ia para o analytics, e comando de Agente costuma
 * conter nome de paciente e valor pago. O agente foi removido do produto em
 * 14/09/2026, mas a trava fica: ela vale para todo campo de texto do app.
 */
export type PropriedadesDeEvento = {
  /** Plano vigente: 'free', 'pro' ou 'fundador'. */
  plano?: string;
  /** Tela que abriu o paywall. */
  origem?: string;
  /** Quantos SMS foram usados no mês. Número, não identifica ninguém. */
  sms_usados?: number;
  /** Comprimento do texto digitado — nunca o texto (20.4). */
  tamanho_do_texto?: number;
  /** Se a operação deu certo. */
  sucesso?: boolean;
  /**
   * Ferramentas que o agente usou para responder, separadas por vírgula —
   * `consultar_mes`, `listar_pendencias`. São nomes fixos do código, não texto
   * da pessoa. Dizem que tipo de pergunta o agente recebe.
   */
  ferramentas?: string;
};
