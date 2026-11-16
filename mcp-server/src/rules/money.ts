import { mensagensDoApp } from './messages.js';

/** Teto de qualquer valor em reais (regra 11.2, `valorValido` do agente). */
export const VALOR_MAXIMO = 1_000_000;

/** Resultado da validação de valor: o inteiro em reais, ou a mensagem do app. */
export type ValorValidado = { valido: true; valor: number } | { valido: false; mensagem: string };

/**
 * Valida um valor em reais (regras 11.1 e 11.2).
 *
 * Mesma regra de `validarValorEmReais` do app: só dígitos, inteiro e > 0. `200,00` e
 * `200.00` são RECUSADOS, nunca arredondados, porque arredondar esconderia da pessoa
 * que o valor gravado não é o digitado. Acima de 1.000.000 também é recusado (11.2,
 * que no app vive em `valorValido`). Aceita número (vindo do modelo) ou texto (vindo
 * do formulário); número com casa decimal é recusado do mesmo jeito.
 */
export function validarValorEmReais(entrada: unknown): ValorValidado {
  const recusa: ValorValidado = { valido: false, mensagem: mensagensDoApp.valorInvalido };
  const texto = typeof entrada === 'number' ? String(entrada) : typeof entrada === 'string' ? entrada.trim() : '';
  if (!/^\d+$/.test(texto)) return recusa;
  const valor = Number.parseInt(texto, 10);
  if (!Number.isSafeInteger(valor) || valor <= 0 || valor > VALOR_MAXIMO) return recusa;
  return { valido: true, valor };
}
