/**
 * Constantes e tipos da despesa, SEM zod (18). O formulário importa daqui; se importasse
 * de schema.ts, o zod inteiro iria junto no HTML e passaria do limite de tamanho do HTML (17).
 */
/** URI do formulário de despesa (13.1). */
export const DESPESA_RESOURCE_URI = 'ui://agenda-psi/despesa.html';

/** Tamanhos máximos dos textos livres (8.2, tabela de campos). */
export const MAX_DESCRICAO = 200;
export const MAX_OBSERVACOES = 1000;

/**
 * Entrada de `salvar_despesa` como chega (permissiva: ver schema.ts). schema.ts confere,
 * em tempo de compilação, que este tipo é igual ao `z.infer` do schema zod.
 */
export type EntradaDespesa = {
  tipo_despesa_id?: string | undefined;
  valor_despesa?: string | undefined;
  data_competencia?: string | undefined;
  descricao?: string | undefined;
  observacoes?: string | undefined;
};

/** A despesa já validada e normalizada: exatamente o que vai para o insert. */
export type DespesaNormalizada = {
  tipo_despesa_id: string;
  valor_despesa: number;
  data_competencia: string;
  descricao: string | null;
  observacoes: string | null;
};

/** Um erro de validação ligado ao campo (12). `campo: null` é a mensagem geral. */
export type ErroDeCampo = { campo: keyof DespesaNormalizada | null; mensagem: string };

/** Uma opção de tipo de despesa. */
export type TipoDespesa = { id: string; nome: string };

/**
 * O que `abrir_formulario_despesa` entrega ao formulário (8.2, passo 2): o
 * pré-preenchimento, os candidatos do tipo e os avisos para a pessoa.
 */
export type PreenchimentoDaDespesa = {
  /** Único por abertura; o formulário o usa para lembrar se já foi salvo (ui/shared/memoria.ts). */
  formulario_id?: string;
  campos: {
    tipo_despesa_id: string | null;
    valor_despesa: string;
    data_competencia: string;
    descricao: string;
    observacoes: string;
  };
  /** Os tipos que casaram com o que a pessoa disse, quando não foi um só (11.15). */
  candidatos: TipoDespesa[];
  avisos: string[];
};

/** Resposta de `salvar_despesa` (13.3 e 12). */
export type RespostaDoSalvar =
  | { ok: true; ids: string[]; resumo: string }
  | { ok: false; erros: ErroDeCampo[] };
