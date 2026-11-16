import type { PacienteDaLinha } from '../shared/pacientes.js';

/**
 * Contrato entre o motor de edição e exclusão (épico 6, 8.6) e o formulário genérico
 * `ui/record/`. Puro: o formulário importa só os tipos. O servidor descreve os campos
 * (rótulo, tipo, valor atual e valor pedido) e o formulário só desenha; assim as nove
 * ações compartilham uma tela, e regra nenhuma mora no navegador.
 */

/** `leitura` aparece como texto (a data da sessão, a competência: somente leitura, 8.6). */
export type TipoDeCampo = 'texto' | 'numero' | 'escolha' | 'marcar' | 'hora' | 'leitura';

export type Campo = {
  nome: string;
  rotulo: string;
  tipo: TipoDeCampo;
  /** Valor no formulário: o pedido pela frase, ou o atual. `marcar` usa 'true'/'false'. */
  valor: string;
  /** Valor gravado hoje, cru, para saber se mudou. */
  atual: string;
  /** Valor gravado hoje, como a pessoa lê, para o "Antes: …" (antes e depois, 8.6). */
  atualRotulo: string;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  prefixo?: string;
  rodape?: string;
};

/** Um registro que a frase pode ter querido dizer, com os seus campos já preenchidos. */
export type Candidato = { id: string; rotulo: string; campos: Campo[]; aviso?: string };

export type PreenchimentoDeRegistro = {
  formulario_id: string;
  acao: string;
  /** "alteração de sessão": para o texto ao modelo no Cancelar. */
  qual: string;
  modo: 'edicao' | 'exclusao';
  /** A ferramenta `salvar_*` que o formulário chama. */
  ferramentaSalvar: string;
  titulo: string;
  avisos: string[];
  /** Seletor de paciente, quando a ação é por paciente (11.14). */
  paciente: PacienteDaLinha | null;
  /** Os argumentos do modelo, para recarregar os candidatos ao escolher o paciente. */
  pedido: string;
  candidatos: Candidato[];
  /** Id do registro já escolhido (um só casou com a frase); senão a pessoa escolhe. */
  escolhido: string | null;
  /** Texto quando não há registro nenhum. */
  vazio: string;
  textos: { salvar: string; salvando: string; aviso: string | null; excluir?: string; confirmar?: string; definitivo?: string };
};

export type ErroDeRegistro = { campo: string | null; mensagem: string };

/**
 * Resposta de `salvar_*`. `continuar` vai de volta no próximo Salvar: a troca de horário
 * usa isso para, depois de gravar o novo e falhar ao tirar o antigo, só tirar o antigo.
 */
export type RespostaDeRegistro =
  | { ok: true; ids: string[]; resumo: string; titulo: string }
  | { ok: false; erros: ErroDeRegistro[]; continuar?: Record<string, string> };
