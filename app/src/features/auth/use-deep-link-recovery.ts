import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';

/**
 * Trata o link de recuperação de senha que chega do e-mail.
 *
 * Como funciona no fluxo PKCE: o link do e-mail abre o app com um `code` de uso
 * único na URL. O app troca esse `code` por uma sessão de recuperação e, com
 * ela, pode chamar `updateUser({ password })`. É o único momento em que o app
 * ganha sessão sem ninguém digitar senha.
 *
 * Por que isto é feito à mão: `detectSessionInUrl` só serve para web, onde
 * existe `window.location`. Em app nativo o link chega pelo `Linking`, e sem
 * este gancho o usuário toca no link do e-mail, o app abre... na tela de login,
 * e ele conclui que o link não funcionou.
 *
 * Implementa: regra 6.4 (recuperação de senha) e o critério de aceite do 8.2
 * "o link abre o app na tela de nova senha".
 *
 * Este fluxo é o caminho crítico da virada de versão: como a atualização
 * desloga toda a base (a sessão do app Flutter vive em SharedPreferences e a do
 * Expo no chaveiro), quem não lembra a senha depende inteiramente daqui.
 */

export type EstadoDaRecuperacao =
  | { tipo: 'ocioso' }
  | { tipo: 'trocando' }
  | { tipo: 'pronta' }
  | { tipo: 'falhou'; mensagem: string };

/** Lê o `code` da URL do deep link, venha na query ou no fragmento. */
function extrairCode(url: string): string | null {
  const { queryParams } = Linking.parse(url);
  const daQuery = queryParams?.code;
  if (typeof daQuery === 'string' && daQuery.length > 0) return daQuery;

  // Alguns clientes de e-mail entregam os parâmetros depois do `#`.
  const cerquilha = url.indexOf('#');
  if (cerquilha >= 0) {
    const doFragmento = new URLSearchParams(url.slice(cerquilha + 1)).get('code');
    if (doFragmento) return doFragmento;
  }

  return null;
}

export function useDeepLinkRecovery(): EstadoDaRecuperacao {
  const [estado, setEstado] = useState<EstadoDaRecuperacao>({ tipo: 'ocioso' });

  useEffect(() => {
    let ativo = true;

    async function tratar(url: string | null) {
      if (!url) return;
      const code = extrairCode(url);
      if (!code) return;

      setEstado({ tipo: 'trocando' });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!ativo) return;

      setEstado(
        error
          ? {
              tipo: 'falhou',
              mensagem:
                'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
            }
          : { tipo: 'pronta' },
      );
    }

    // O app pode ter sido ABERTO pelo link, ou já estar aberto quando ele chega.
    // Os dois casos existem e os dois precisam funcionar.
    void Linking.getInitialURL().then(tratar);
    const inscricao = Linking.addEventListener('url', ({ url }) => void tratar(url));

    return () => {
      ativo = false;
      inscricao.remove();
    };
  }, []);

  return estado;
}

/** URL de retorno do e-mail de recuperação. Casa com o `scheme` do app.json. */
export function urlDeRetornoDaSenha(): string {
  return Linking.createURL('nova-senha');
}
