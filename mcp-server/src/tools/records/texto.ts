/** Texto para o modelo depois de gravar (13.3), com o id para outras mudanças. Puro: a UI importa. */
export function textoDoRegistroParaOModelo(resumo: string, ids: string[]): string {
  return `${resumo} (id ${ids.join(', ')}).`;
}
