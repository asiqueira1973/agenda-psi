/**
 * Configuração do servidor, lida das variáveis de ambiente (seção 18).
 *
 * Valores públicos: a URL e a chave publicável do Supabase (inúteis sem passar pela
 * RLS), a URL pública do MCP e a chave de ingestão do Visão do Produto (só escrita).
 * O único segredo é `MCP_PREVIEW_SECRET`, do HMAC do fallback (13.4 e 20). Nenhuma
 * chave privilegiada do Supabase existe neste servidor (P1).
 */
export type Config = {
  /** URL do projeto Supabase, sem barra no fim. */
  supabaseUrl: string;
  /** Chave publicável do Supabase. */
  supabasePublishableKey: string;
  /** URL que a pessoa digita no conector; vira o `resource` do PRM (6.2). */
  publicUrl: string;
  /** Emissor esperado no `iss` do token: `<supabaseUrl>/auth/v1` (6.4). */
  issuer: string;
  /**
   * Só local (8.1.3): aceita token de sessão comum, sem `client_id`, para o
   * `npm run dev:token`. Essa variável NUNCA existe no deploy.
   */
  devAllowSessionToken: boolean;
  /** Segredo do HMAC do `token_previa` (13.4); no mínimo 32 caracteres. */
  previewSecret: string;
  /**
   * Visão do Produto (21). Opcional: sem chave, o servidor roda e não emite evento,
   * como o app. Localmente fica vazia, para a conta de teste não entrar na série.
   */
  analytics: { url: string; key: string } | null;
};

/** Endpoint de ingestão do Visão do Produto, o mesmo padrão do app (app/src/lib/env.ts). */
const ANALYTICS_URL_PADRAO = 'https://api.visaodeproduto.com.br/functions/v1/ingest';

/** Lê uma variável obrigatória; falha alto se faltar, para o deploy não subir meio configurado. */
function obrigatoria(env: Record<string, string | undefined>, nome: string): string {
  const valor = env[nome]?.trim();
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

/**
 * Monta a configuração a partir de `env` (padrão: `process.env`). Recebe o objeto
 * para os testes poderem passar valores fixos.
 */
export function lerConfig(env: Record<string, string | undefined> = process.env): Config {
  const supabaseUrl = obrigatoria(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const devAllowSessionToken = env.MCP_DEV_ALLOW_SESSION_TOKEN === '1';
  // A Vercel define VERCEL=1 em todo build e função. Com a flag de dev junto, o token
  // de sessão do app passaria a valer em produção (6.4). Melhor não subir (8.1.3).
  if (devAllowSessionToken && env.VERCEL) {
    throw new Error('MCP_DEV_ALLOW_SESSION_TOKEN não pode existir no deploy. Remova a variável na Vercel.');
  }
  const previewSecret = obrigatoria(env, 'MCP_PREVIEW_SECRET');
  // Segredo curto deixaria o token_previa adivinhável; P2 depende dele.
  if (previewSecret.length < 32) throw new Error('MCP_PREVIEW_SECRET precisa ter pelo menos 32 caracteres.');
  const analyticsKey = env.VISAODEPRODUTO_KEY?.trim();
  return {
    supabaseUrl,
    supabasePublishableKey: obrigatoria(env, 'SUPABASE_PUBLISHABLE_KEY'),
    publicUrl: obrigatoria(env, 'MCP_PUBLIC_URL'),
    issuer: `${supabaseUrl}/auth/v1`,
    devAllowSessionToken,
    previewSecret,
    analytics: analyticsKey ? { url: env.VISAODEPRODUTO_URL?.trim() || ANALYTICS_URL_PADRAO, key: analyticsKey } : null,
  };
}
