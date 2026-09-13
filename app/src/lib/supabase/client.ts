import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';
import { secureSessionStorage } from './secure-session-storage';
import type { Database } from './database.types';

/**
 * Cliente único do Supabase.
 *
 * Tipado com o `Database` gerado do banco real, para que uma coluna renomeada
 * numa migration quebre o `tsc` em vez de quebrar a tela em produção.
 *
 * Implementa: 4.1 (stack), 8.1 (entregas da fundação) e 6.4 (sessão).
 *
 * Pegadinhas que este arquivo sustenta (spec 18):
 * - a sessão fica no chaveiro do aparelho, partida em pedaços;
 * - nenhuma chave secreta passa por aqui, só a publicável;
 * - o app nunca escreve em `assinaturas` — quem grava é a Edge Function
 *   rc-webhook com service_role (spec 5, 11.6 e a máquina 12.1).
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      storage: secureSessionStorage,
      // Mantém o usuário logado entre aberturas (critério de aceite de 8.1).
      persistSession: true,
      autoRefreshToken: true,
      // Não há navegador embutido: o deep link da recuperação de senha é
      // tratado à mão em features/auth/use-deep-link-recovery (spec 6.4).
      detectSessionInUrl: false,
      // PKCE é o fluxo certo para app nativo. O link do e-mail volta com um
      // `code` de uso único, trocado por sessão dentro do app — em vez de
      // trazer o token na própria URL, onde ele fica no histórico do navegador
      // e nos logs de quem estiver no caminho.
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-Client-Info': `agenda-psi-${Platform.OS}`,
      },
    },
  },
);

/**
 * Liga e desliga a renovação automática do token conforme o app vai para
 * frente ou para trás.
 *
 * Sem isto o timer de refresh continua rodando com o app em segundo plano,
 * gastando bateria para renovar um token que ninguém vai usar — e, pior, pode
 * errar a renovação depois de muito tempo suspenso. É a recomendação do próprio
 * Supabase para React Native.
 *
 * Devolve: a função para cancelar a assinatura do AppState.
 */
export function startSessionAutoRefresh(): () => void {
  const assinatura = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === 'active') {
    void supabase.auth.startAutoRefresh();
  }

  return () => assinatura.remove();
}
