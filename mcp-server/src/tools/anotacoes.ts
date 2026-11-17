import type { McpServer } from '@modelcontextprotocol/server';

/**
 * Título e dica de leitura/escrita de TODA ferramenta, num lugar só (13.1 e requisito do
 * Connectors Directory da Anthropic: "every tool includes a `title` and the applicable
 * `readOnlyHint` or `destructiveHint`"). As dicas decidem as permissões automáticas no
 * Claude: leitura roda sem confirmação; o que modifica ou apaga pede confirmação. O
 * diretório do ChatGPT exige também `openWorldHint` explícito: sempre `false`, porque toda
 * ferramenta age só sobre a conta da própria pessoa.
 *
 * - leitura: as 9 consultas, as listas de opções e os `abrir_formulario_*` (que só montam o
 *   pré-preenchimento: não gravam nada, P2);
 * - escrita: `salvar_*` e `registrar_*`, que criam, alteram ou apagam. O diretório pede
 *   `destructiveHint` para tudo que "modify or delete data", então criar também conta.
 *
 * Os títulos aparecem na interface do host. Os de formulário vêm do app e do agente (já
 * definidos em cada `abrir_formulario_*`); os demais são novos e estão listados em
 * plans/diretorio.md para aprovação.
 */

/** Títulos das ferramentas que não são `abrir_formulario_*`, `salvar_*` nem `registrar_*`. */
export const TITULOS: Record<string, string> = {
  buscar_paciente: 'Buscar paciente',
  historico_do_paciente: 'Histórico do paciente',
  listar_pacientes: 'Listar pacientes',
  consultar_periodo: 'Consultar período',
  consultar_mes: 'Consultar mês',
  agenda_do_dia: 'Agenda do dia',
  agenda_da_semana: 'Agenda da semana',
  listar_pendencias: 'Listar pendências',
  consultar_despesas: 'Consultar despesas',
  listar_tipos_despesa: 'Tipos de despesa',
  buscar_pacientes_opcoes: 'Pacientes para o formulário',
  listar_agenda: 'Agenda para o formulário',
  listar_registros: 'Registros para o formulário',
};

/** O que cada ação grava, para os títulos de `salvar_*` e `registrar_*`. */
export const ACOES: Record<string, string> = {
  despesa: 'despesa',
  sessoes: 'sessões',
  pagamentos: 'pagamentos',
  paciente: 'paciente',
  horarios: 'horários',
  feedback: 'feedback',
  troca_horario: 'troca de horário',
  remocao_horario: 'remoção de horário',
  edicao_paciente: 'alteração de cadastro',
  edicao_sessao: 'alteração de sessão',
  exclusao_sessao: 'exclusão de sessão',
  edicao_pagamento: 'alteração de pagamento',
  exclusao_pagamento: 'exclusão de pagamento',
  edicao_despesa: 'alteração de despesa',
  exclusao_despesa: 'exclusão de despesa',
};

export type Anotacao = { title: string; escrita: boolean };

/**
 * Título e tipo de uma ferramenta pelo nome. `tituloDado` é o que o registro já trouxe
 * (os `abrir_formulario_*` trazem o do app). Sem título conhecido: `null`, e o registro
 * falha, para nenhuma ferramenta nova sair sem anotação.
 */
export function anotacaoDe(nome: string, tituloDado: string | undefined): Anotacao | null {
  const salvar = nome.match(/^salvar_(.+)$/);
  const registrar = nome.match(/^registrar_(.+)$/);
  if (salvar?.[1] && ACOES[salvar[1]]) return { title: `Salvar ${ACOES[salvar[1]]}`, escrita: true };
  if (registrar?.[1] && ACOES[registrar[1]]) return { title: `Registrar ${ACOES[registrar[1]]} sem formulário`, escrita: true };
  const title = tituloDado ?? TITULOS[nome];
  return title ? { title, escrita: false } : null;
}

type ConfigDeFerramenta = { title?: string; annotations?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Faz o `server.registerTool` (que o `registerAppTool` do ext-apps também usa) completar o
 * título e as dicas de toda ferramenta registrada depois desta chamada. Preserva o que o
 * registro já trouxe (ex.: `idempotentHint`), mas a dica de leitura/escrita é sempre a
 * desta tabela, para não haver duas fontes.
 */
export function exigirAnotacoes(server: McpServer): void {
  const original = server.registerTool.bind(server) as (nome: string, config: ConfigDeFerramenta, cb: unknown) => unknown;
  (server as unknown as { registerTool: typeof original }).registerTool = (nome, config, cb) => {
    const a = anotacaoDe(nome, config.title);
    if (!a) throw new Error(`ferramenta sem título em src/tools/anotacoes.ts: ${nome}`);
    const annotations = {
      ...config.annotations,
      title: a.title,
      readOnlyHint: !a.escrita,
      destructiveHint: a.escrita,
      // Só a conta da própria pessoa, nunca a web aberta (exigido pelo diretório do ChatGPT).
      openWorldHint: false,
    };
    return original(nome, { ...config, title: a.title, annotations }, cb);
  };
}
