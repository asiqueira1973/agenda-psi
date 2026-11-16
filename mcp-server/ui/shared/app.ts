import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { normalizar } from '../../src/rules/text.js';

/**
 * Bootstrap comum dos formulários do épico 5 (8.2, passo 3; 16):
 * - cria o `App` e registra os handlers ANTES do `connect` (o resultado da ferramenta
 *   chega uma vez só);
 * - aplica o tema do host (claro/escuro, variáveis e fontes);
 * - `onTeardown` responde vazio.
 */
export function criarFormulario(nome: string, onResultado: (r: CallToolResult) => void, onConectado: (app: App) => void): App {
  const app = new App({ name: `Agenda Psi — ${nome}`, version: '0.5.0' });
  app.ontoolresult = (r) => onResultado(r as CallToolResult);
  app.onhostcontextchanged = aplicarTema;
  app.onteardown = async () => ({});
  void app.connect().then(() => {
    aplicarTema(app.getHostContext());
    onConectado(app);
  });
  return app;
}

/** Aplica o tema do host (16). */
export function aplicarTema(ctx: McpUiHostContext | undefined): void {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

/** `document.getElementById` tipado. */
export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Cria um elemento com atributos e filhos, sem `innerHTML` (nada de injeção). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...filhos: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('aria-') || k === 'for' || k.startsWith('data-')) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...filhos);
  return e;
}

/**
 * Monta um `<select>` de pacientes: vazio no começo, candidatos (11.14) e o já escolhido
 * em primeiro, mesmo inativos, para nunca haver paciente escolhido que não aparece. Os
 * demais são os ativos cujo nome contém o `filtro` da busca (8.5), sem acento nem caixa.
 */
export function opcoesDePaciente(
  select: HTMLSelectElement,
  pacientes: Array<{ id: string; nome: string; ativo?: boolean }>,
  candidatos: string[],
  placeholder: string,
  filtro = '',
  selecionado = '',
): void {
  const fixos = selecionado ? [...candidatos, selecionado] : candidatos;
  const termo = normalizar(filtro);
  select.replaceChildren(new Option(placeholder, ''));
  const primeiro = pacientes.filter((p) => fixos.includes(p.id));
  const resto = pacientes.filter((p) => !fixos.includes(p.id) && p.ativo !== false && normalizar(p.nome).includes(termo));
  for (const p of [...primeiro, ...resto]) select.add(new Option(p.nome, p.id));
  select.value = selecionado;
}

/** Põe a busca de paciente (8.5) entre o rótulo e o `<select>` de um campo. */
export function comBusca(campo: HTMLElement, busca: HTMLInputElement, select: HTMLSelectElement): HTMLElement {
  campo.insertBefore(busca, select);
  return campo;
}
