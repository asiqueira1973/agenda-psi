import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, startSessionAutoRefresh } from '@/lib/supabase/client';

/**
 * Sessão do Supabase disponível para o app inteiro.
 *
 * Guarda três coisas e nada mais: a sessão, se ela ainda está sendo carregada
 * do chaveiro, e o usuário derivado dela. A regra de acesso do app — consultar
 * `v_profissional_atual` e deslogar quem está inativo — NÃO mora aqui; ela é do
 * épico 8.2 e da regra 6.3, e fica no guardião de rota, porque envolve ir ao
 * banco e mostrar mensagem.
 *
 * `loading` existe para o app não piscar a tela de login antes de ler a sessão
 * gravada. É o que faz "fechar e reabrir o app mantém a sessão" ser verdade na
 * tela, e não só no armazenamento (critério de aceite de 8.1).
 *
 * Implementa: 6.4 (sessão), 8.1 e 8.2.
 */

type SessionState = {
  session: Session | null;
  /** Ainda lendo a sessão gravada no aparelho. */
  loading: boolean;
  /** `auth.users.id` do usuário autenticado. É o `usuario_id` de todo o banco. */
  usuarioId: string | null;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    // Primeira leitura: o que estiver gravado no chaveiro.
    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      setLoading(false);
    });

    // Daí em diante, quem manda é o evento: login, logout, token renovado e
    // recuperação de senha por deep link passam todos por aqui.
    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSession(nova);
    });

    const pararAutoRefresh = startSessionAutoRefresh();

    return () => {
      ativo = false;
      inscricao.subscription.unsubscribe();
      pararAutoRefresh();
    };
  }, []);

  const valor = useMemo<SessionState>(
    () => ({ session, loading, usuarioId: session?.user.id ?? null }),
    [session, loading],
  );

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}

/** Lê a sessão. Só funciona dentro do SessionProvider. */
export function useSession(): SessionState {
  const contexto = useContext(SessionContext);
  if (!contexto) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return contexto;
}
