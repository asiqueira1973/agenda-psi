import { categoriasDoFeedbackDoApp, copyFeedbackDoApp } from '../../rules/copy-app.js';

/**
 * Feedback para a equipe (8.5, 11.21), puro: o formulário importa as mesmas regras.
 * Mensagem obrigatória (spec 8.10, como a tela de Ajustes) e cortada em 2000 caracteres,
 * como `proporFeedback` do agente. Categoria desconhecida vira "problema", como lá.
 */

export type Categoria = (typeof categoriasDoFeedbackDoApp)[number]['valor'];
export const CATEGORIAS = categoriasDoFeedbackDoApp.map((c) => c.valor) as [Categoria, ...Categoria[]];
export const MENSAGEM_MAXIMA = 2000;

export type FormularioDeFeedback = { categoria: string; mensagem: string };
export type FeedbackNormalizado = { categoria: Categoria; mensagem: string };

export function validarFeedback(f: Partial<FormularioDeFeedback>):
  { ok: true; dados: FeedbackNormalizado } | { ok: false; erros: Array<{ campo: string; mensagem: string }> } {
  const mensagem = (f.mensagem ?? '').trim().slice(0, MENSAGEM_MAXIMA);
  if (!mensagem) return { ok: false, erros: [{ campo: 'mensagem', mensagem: copyFeedbackDoApp.vazia }] };
  const categoria = (CATEGORIAS as string[]).includes(f.categoria ?? '') ? (f.categoria as Categoria) : 'problema';
  return { ok: true, dados: { categoria, mensagem } };
}

/**
 * Texto gravado: o prefixo de `textoDoFeedback` do agente com a origem trocada para
 * "via conector" (plans/epico-5.md, texto 5), para o painel distinguir de onde veio.
 */
export function textoDoFeedback(f: FeedbackNormalizado): string {
  const rotulo = categoriasDoFeedbackDoApp.find((c) => c.valor === f.categoria)?.rotulo ?? 'Problema';
  return `[${rotulo} · via conector] ${f.mensagem}`;
}

export function textoDoFeedbackParaOModelo(id: string): string {
  return `Feedback enviado à equipe do Agenda Psi (id ${id}).`;
}
