/**
 * Validações de formulário.
 *
 * Implementa: regra 11.2 (preço) e os textos de erro da 15.3, que são finais.
 */
import { copyAuth } from '@/features/auth/copy';

/** Resultado de validação: ou passa, ou passa com uma mensagem de erro. */
export type Validacao = { valido: true } | { valido: false; mensagem: string };

const OK: Validacao = { valido: true };

/**
 * Valida um valor em reais.
 *
 * Regra 11.2: obrigatório, inteiro POSITIVO. Vírgula, ponto e vazio são
 * rejeitados **no app**, antes do insert.
 *
 * O banco é mais permissivo — o CHECK é `preco >= 0`, ou seja, aceita zero — e
 * essa diferença é proposital: zero é tecnicamente válido e não faz sentido de
 * negócio. Sessão de graça se registra com observação, não com preço zero.
 *
 * O que o app atual faz e que isto corrige (defeito 11.9.6): campo vazio ou com
 * vírgula vira `NULL` num insert contra coluna `NOT NULL`, a escrita falha, e a
 * tela mostra sucesso assim mesmo.
 *
 * Casos que a seção 22 exige testar: `200`, `200,00`, `200.00`, vazio, `abc`,
 * `-5` e `0`.
 */
export function validarValorEmReais(texto: string): Validacao {
  const limpo = texto.trim();

  if (limpo.length === 0) {
    return { valido: false, mensagem: mensagens.valorInvalido };
  }

  // Só dígitos. `200,00` e `200.00` caem aqui, e é intencional: o app não
  // aceita centavos, e aceitar a vírgula "arredondando" esconderia do usuário
  // que o valor gravado não é o que ele digitou.
  if (!/^\d+$/.test(limpo)) {
    return { valido: false, mensagem: mensagens.valorInvalido };
  }

  const numero = Number.parseInt(limpo, 10);
  if (!Number.isFinite(numero) || numero <= 0) {
    return { valido: false, mensagem: mensagens.valorInvalido };
  }

  return OK;
}

/** Converte o texto já validado em inteiro. Chame só depois de validar. */
export function valorEmReaisParaInteiro(texto: string): number {
  return Number.parseInt(texto.trim(), 10);
}

/** Nome é obrigatório, no cadastro E na edição (correção do defeito 11.9.23). */
export function validarNome(texto: string): Validacao {
  return texto.trim().length > 0 ? OK : { valido: false, mensagem: mensagens.nomeVazio };
}

/** Telefone é obrigatório, no cadastro E na edição (defeito 11.9.23). */
export function validarTelefone(texto: string): Validacao {
  return texto.trim().length > 0
    ? OK
    : { valido: false, mensagem: mensagens.telefoneVazio };
}

/** E-mail é opcional no paciente; quando preenchido, precisa ter cara de e-mail. */
export function validarEmailOpcional(texto: string): Validacao {
  const limpo = texto.trim();
  if (limpo.length === 0) return OK;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)
    ? OK
    : { valido: false, mensagem: copyAuth.erros.emailInvalido };
}

/**
 * Hora fim precisa ser depois da hora início.
 *
 * O app atual não valida, e por isso aceita um agendamento das 15h às 14h
 * (critério de aceite de 8.8). Compara texto `HH:MM` direto, o que funciona
 * porque o formato é de largura fixa e zero à esquerda.
 */
export function validarIntervaloDeHoras(inicio: string, fim: string): Validacao {
  if (!inicio || !fim) return { valido: false, mensagem: mensagens.horarioIncompleto };
  return fim > inicio ? OK : { valido: false, mensagem: mensagens.horaFimAntesDoInicio };
}

/**
 * Textos de erro de validação.
 *
 * Os três primeiros são literais da seção 15.3 do spec e não devem ser
 * reescritos. Os demais vêm do handoff de design.
 */
export const mensagens = {
  /** Literal da 15.3. */
  valorInvalido: 'Informe um valor inteiro, sem centavos. Ex: 200',
  /** Literal da 15.3. */
  nomeVazio: 'O nome é obrigatório',
  /** Literal da 15.3. */
  telefoneVazio: 'O telefone é obrigatório',
  /** Literal da 15.3. */
  tipoDeDespesaNaoEscolhido: 'Escolha o tipo da despesa',
  /** Do handoff, tela 19. */
  tipoDeDespesaObrigatorio: 'O tipo é obrigatório para salvar.',
  /** Do handoff, tela 7a. */
  pacienteNaoEscolhido: 'Escolha o paciente',
  /** Do handoff, tela 7a. */
  horaFimAntesDoInicio: 'A hora fim precisa ser depois da hora início',
  horarioIncompleto: 'Informe a hora de início e a de fim',
} as const;
