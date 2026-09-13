/**
 * Formatação de tudo que aparece na tela.
 *
 * Implementa a tabela da regra 11.3 do spec, literalmente. Os exemplos dos
 * comentários são os da própria tabela, e a seção 22 exige teste para cada um.
 *
 * Feito à mão em vez de `Intl.NumberFormat` de propósito: o resultado precisa
 * ser idêntico no iOS, no Android e no teste, independentemente de o aparelho
 * ter dado de locale instalado. Formatador de dinheiro que muda de forma
 * conforme o aparelho é defeito difícil de reproduzir.
 */

/** Insere o ponto de milhar à brasileira: 1234567 vira 1.234.567. */
function separarMilhar(inteiro: number): string {
  const negativo = inteiro < 0;
  const digitos = Math.abs(inteiro).toString();
  let saida = '';
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) saida += '.';
    saida += digitos[i];
  }
  return negativo ? `-${saida}` : saida;
}

/**
 * Dinheiro em reais, SEM centavos.
 *
 * Todo valor do app é inteiro: `precos_paciente.preco`,
 * `pagamentos.valor_pagamento` e `despesas.valor_despesa` são `integer` no
 * banco, e 200 quer dizer R$ 200,00 (regra 11.2).
 *
 * Nulo vira `R$ 0`, não `R$ —`: o dashboard tem indicador que legitimamente
 * vale zero, e travessão ali pareceria falha de carregamento (regra 11.3).
 *
 * Correção em relação ao app atual, que imprime o inteiro cru — `1234` em vez
 * de `R$ 1.234` (assunção 24.12).
 */
export function formatarDinheiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'R$ 0';
  return `R$ ${separarMilhar(Math.trunc(valor))}`;
}

/**
 * Percentual com uma casa decimal e vírgula: `42,5%`.
 * Nulo vira `0%`, pelo mesmo motivo do dinheiro (regra 11.3).
 */
export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '0%';
  return `${valor.toFixed(1).replace('.', ',')}%`;
}

/** Inteiro com separador de milhar. Nulo vira `0` (regra 11.3). */
export function formatarInteiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '0';
  return separarMilhar(Math.trunc(valor));
}

/**
 * Data como `dd/MM/yyyy`, COM zero à esquerda: `05/03/2026`.
 *
 * O app atual imprime `5/3/2026` (assunção 24.11). O zero à esquerda é o padrão
 * brasileiro e é o que mantém a coluna de datas alinhada numa lista.
 *
 * Recebe a data como o banco devolve: `YYYY-MM-DD` para coluna `date`, ou ISO
 * completo para `timestamptz`. Nulo vira travessão.
 *
 * Coluna `date` é lida como texto e fatiada, nunca convertida para `Date`:
 * `new Date('2026-03-05')` é meia-noite UTC, que no fuso de Brasília é dia 4.
 * Data escolhida pelo usuário não tem hora nem fuso (regra 11.8).
 */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—';

  const soData = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (soData) {
    const [, ano, mes, dia] = soData;
    return `${dia}/${mes}/${ano}`;
  }

  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/** Hora em 24h: `14:30`. Aceita `HH:MM:SS` do tipo `time` do banco. */
export function formatarHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const m = /^(\d{2}):(\d{2})/.exec(valor);
  return m ? `${m[1]}:${m[2]}` : '—';
}

/**
 * Telefone com DDI: `+55 21 99999-9999`.
 *
 * O banco guarda com `+` e DDI (regra 11.3). Número que não seja do formato
 * brasileiro conhecido é devolvido como veio — melhor mostrar cru do que
 * embaralhar o número de alguém.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '—';

  const digitos = valor.replace(/\D/g, '');

  // +55 DD 9XXXX-XXXX (celular) e +55 DD XXXX-XXXX (fixo).
  const brasileiro = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  if (brasileiro) {
    const [, ddd, inicio, fim] = brasileiro;
    return `+55 ${ddd} ${inicio}-${fim}`;
  }

  return valor;
}

/** Nomes dos dias, indexados por `agenda_semana_padrao.dia_semana` (1 a 7). */
const diasDaSemana = [
  '',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
] as const;

/**
 * Nome do dia a partir do valor do banco.
 *
 * ATENÇÃO à convenção, que não é a do JavaScript: no banco 1 é SEGUNDA e 7 é
 * domingo (regra 11.4 e 7.2). Em `Date.getDay()` 0 é domingo. Confundir os dois
 * é o caminho mais curto para reproduzir o defeito 11.9.4, em que salvar as
 * notas de um agendamento mudava o dia dele.
 */
export function nomeDoDiaDaSemana(dia: number | null | undefined): string {
  if (!dia || dia < 1 || dia > 7) return '—';
  return diasDaSemana[dia];
}

/** Versão curta, para o segmented de 7 posições da agenda. */
export function nomeCurtoDoDiaDaSemana(dia: number): string {
  return ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][dia] ?? '—';
}

/**
 * Converte o dia da semana do JavaScript (0 = domingo) para o do banco
 * (1 = segunda, 7 = domingo). É o que a agenda usa para abrir no dia de hoje.
 */
export function diaDaSemanaDoBanco(data: Date): number {
  const js = data.getDay();
  return js === 0 ? 7 : js;
}
