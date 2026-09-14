/**
 * Configuração pública do app, lida do ambiente.
 *
 * Tudo aqui é `EXPO_PUBLIC_*`, ou seja, embutido no bundle em tempo de build e
 * legível por quem abrir o IPA ou o APK. É de propósito: as duas chaves são
 * públicas por design — a do Supabase é inútil sem passar pela RLS, e a do
 * Visão do Produto é de ingestão, só escrita.
 *
 * Não há chave de compra: a assinatura é direto nas lojas, e quem autentica é
 * a conta da loja no aparelho.
 *
 * O que NÃO pode aparecer neste arquivo, nem em nenhum outro do app: a
 * service_role do Supabase, os segredos do n8n e os das lojas. Esses vivem só
 * nos secrets das Edge Functions (spec P4 e 18).
 *
 * Implementa: seção 18 do spec (variáveis de ambiente) e o princípio P4.
 */

/**
 * Lê uma variável obrigatória e explode cedo se ela faltar.
 *
 * Falhar no start é melhor do que falhar na primeira chamada de rede, quando o
 * usuário já digitou a senha e leva um erro que parece do servidor.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Veja o .env.example e o README.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  /** Ingestão de analytics. Opcional: sem ela o app roda e não emite evento. */
  analyticsKey: process.env.EXPO_PUBLIC_VISAODEPRODUTO_KEY,
  analyticsUrl:
    process.env.EXPO_PUBLIC_VISAODEPRODUTO_URL ??
    'https://api.visaodeproduto.com.br/functions/v1/ingest',
} as const;
