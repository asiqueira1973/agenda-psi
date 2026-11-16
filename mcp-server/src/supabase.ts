import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';
import type { Database } from './database.types.js';

/** Cliente tipado pelo schema gerado; os nomes do banco ficam em português (seção 18). */
export type DbClient = SupabaseClient<Database>;

/**
 * Cria o cliente Supabase COMO o usuário (P1): chave publicável + o JWT dele no
 * cabeçalho, então toda leitura e escrita passa pela RLS.
 *
 * Um cliente por request, sem sessão guardada nem renovação automática: o servidor é
 * stateless (4.3) e quem renova o token é o cliente MCP (6.6).
 */
export function criarClienteDoUsuario(config: Config, accessToken: string): DbClient {
  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Cliente anônimo (só a chave publicável), usado para verificar o token pelo
 * Supabase Auth (6.4). Não lê dado nenhum.
 */
export function criarClienteAnonimo(config: Config): DbClient {
  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
