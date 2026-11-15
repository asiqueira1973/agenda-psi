/**
 * Formatação de dinheiro e data como o app mostra (regra 11.3 do spec do app),
 * portada de app/src/lib/format.ts. Feita à mão, sem `Intl`, pelo mesmo motivo do
 * app: o resultado tem que ser idêntico em qualquer ambiente. Usada nos resumos que
 * voltam ao modelo e no formulário.
 */

/** Ponto de milhar à brasileira: 1234567 vira 1.234.567. */
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

/** Reais sem centavos: 1450 vira `R$ 1.450`; nulo vira `R$ 0` (como `formatarDinheiro`). */
export function formatarDinheiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'R$ 0';
  return `R$ ${separarMilhar(Math.trunc(valor))}`;
}

/**
 * Data `AAAA-MM-DD` como `dd/mm/aaaa`, fatiando o texto (nunca via `Date`, que em
 * Brasília volta um dia). Nulo ou fora do formato vira travessão, como no app.
 */
export function formatarData(valor: string | null | undefined): string {
  const m = valor ? /^(\d{4})-(\d{2})-(\d{2})/.exec(valor) : null;
  if (!m) return '—';
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
}
