import { createHash } from 'node:crypto';

/**
 * Hash curto do `sub`, para correlacionar chamadas da mesma pessoa no log sem
 * gravar o id dela (seção 18, Logs).
 */
export function hashDoSub(sub: string): string {
  return createHash('sha256').update(sub).digest('hex').slice(0, 12);
}

/**
 * Uma linha de log por chamada de ferramenta (seção 18): só o nome, a duração, ok ou
 * erro e o hash do `sub`. NUNCA argumentos, resultados, tokens, nomes ou valores.
 */
export function logarChamada(ferramenta: string, inicio: number, ok: boolean, sub: string): void {
  console.log(JSON.stringify({
    ferramenta,
    ms: Math.round(performance.now() - inicio),
    ok,
    usuario: hashDoSub(sub),
  }));
}
