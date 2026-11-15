import * as z from 'zod';

import type { EntradaDespesa } from './model.js';

export * from './model.js';

/**
 * Entrada de `salvar_despesa` e o núcleo de `registrar_despesa` (18: um schema por
 * ação, compartilhado entre save, fallback e formulário).
 *
 * Os campos têm o nome da coluna do banco, sem camada de tradução (CLAUDE.md). Tudo é
 * permissivo DE PROPÓSITO: falta de campo ou valor errado não pode virar erro de
 * protocolo do zod, em inglês; tem que chegar em `validarDespesa`, que devolve o erro
 * no campo, em português (8.2, critérios 3 e 4). Tudo é texto porque o formulário manda
 * o que foi digitado, e `1450,50` precisa ser recusado, não convertido. Sem `anyOf`
 * (união ou nulo): alguns hosts não aceitam, e o Inspector acusa como não portável.
 * Sem `usuario_id` (P1).
 */
export const camposDaDespesa = {
  tipo_despesa_id: z.string().optional().describe('Id do tipo de despesa (de listar_tipos_despesa).'),
  valor_despesa: z.string().optional().describe('Valor em reais como digitado; inteiro, sem centavos.'),
  data_competencia: z.string().optional().describe('Data de competência, AAAA-MM-DD.'),
  descricao: z.string().optional().describe('Descrição curta, até 200 caracteres.'),
  observacoes: z.string().optional().describe('Observações, até 1000 caracteres.'),
};

export const entradaSalvarDespesa = z.object(camposDaDespesa);

// O tipo à mão de model.ts (sem zod, para o formulário) tem que ser o mesmo do schema.
type Igual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const _mesmoTipo: Igual<EntradaDespesa, z.infer<typeof entradaSalvarDespesa>> = true;
void _mesmoTipo;

