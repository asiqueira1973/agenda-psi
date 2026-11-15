import { createMcpHandler, McpServer, type AuthInfo, type McpHttpHandler } from '@modelcontextprotocol/server';
import { emailDoAuthInfo, subDoAuthInfo } from './auth/verify-token.js';
import type { SuporteAUi } from './client-capabilities.js';
import type { Config } from './config.js';
import { criarClienteDoUsuario } from './supabase.js';
import { registrarFerramentas } from './tools/index.js';

/** Identificação do servidor no `initialize` / `server/discover`. */
export const SERVER_INFO = { name: 'agenda-psi', version: '0.2.0' } as const;

/** Lê o suporte a UI que o app.ts anexou ao `authInfo` deste request (13.4). */
function uiDoAuthInfo(authInfo: AuthInfo | undefined): SuporteAUi {
  const ui = (authInfo?.extra as { ui?: SuporteAUi } | undefined)?.ui;
  return ui === 'sim' || ui === 'nao' ? ui : 'desconhecido';
}

/**
 * Monta o handler MCP stateless (4.3): um `McpServer` novo por request, sem sessão em
 * memória, servindo a revisão 2026-07-28 e, pelo fallback do SDK, os clientes de 2025.
 *
 * A fábrica recebe o `authInfo` já verificado em app.ts (o SDK não verifica token, só
 * repassa) e cria o cliente Supabase COMO o usuário (P1). Sem `authInfo`, falha:
 * nenhuma ferramenta roda sem usuário.
 */
export function criarHandlerMcp(config: Config): McpHttpHandler {
  return createMcpHandler(({ authInfo }) => {
    const sub = subDoAuthInfo(authInfo);
    // authInfo existe aqui: subDoAuthInfo lança quando falta.
    const db = criarClienteDoUsuario(config, authInfo!.token);
    const server = new McpServer(SERVER_INFO);
    registrarFerramentas(server, { db, sub, email: emailDoAuthInfo(authInfo), config, ui: uiDoAuthInfo(authInfo) });
    return server;
  });
}
