import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from './session-provider';

/**
 * A ficha do profissional autenticado, lida de `v_profissional_atual`.
 *
 * A view se auto-filtra por `auth.uid()`, então não há `where` a escrever aqui
 * — e não deve haver. Filtrar de novo no cliente daria a impressão de que é o
 * app que decide quem vê o quê, e não é: quem decide é a RLS (princípio P2).
 *
 * Implementa: regra 6.3 e o épico 8.2.
 */

export const chaveProfissionalAtual = ['profissional-atual'] as const;

export function useProfissionalAtual() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chaveProfissionalAtual, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_profissional_atual')
        .select('usuario_id, nome, email, telefone, linkedin, instagram, ativo')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Estado de acesso ao app, conforme a regra 6.3.
 *
 * Autenticar no Supabase não basta. Depois do login, o app consulta
 * `v_profissional_atual` e decide:
 *
 * - `liberado`   — existe ficha e `ativo` é verdadeiro OU NULO. Nulo significa
 *                  ativo: a coluna é nullable com default true, e a view já faz
 *                  COALESCE(ativo, true) (spec 6.3 e 7.2);
 * - `bloqueado`  — existe ficha e `ativo = false`. A tela mostra o alerta da
 *                  15.2 e desloga. É assim que a exclusão de conta funciona;
 * - `sem_ficha`  — autenticado sem registro em `profissionais`. Leva para Nova
 *                  conta completar o cadastro. O app atual só faz isso no fluxo
 *                  Apple; aqui vale para todos (6.3, passo 5);
 * - `carregando` / `erro` — o de sempre.
 */
export type EstadoDeAcesso = 'carregando' | 'liberado' | 'bloqueado' | 'sem_ficha' | 'erro';

export function useEstadoDeAcesso(): {
  estado: EstadoDeAcesso;
  recarregar: () => void;
} {
  const { session, loading: carregandoSessao } = useSession();
  const consulta = useProfissionalAtual();

  let estado: EstadoDeAcesso;

  if (carregandoSessao || (session && consulta.isPending)) {
    estado = 'carregando';
  } else if (!session) {
    // Sem sessão não é erro nem bloqueio: é gente que ainda não entrou.
    estado = 'sem_ficha';
  } else if (consulta.isError) {
    estado = 'erro';
  } else if (!consulta.data) {
    estado = 'sem_ficha';
  } else if (consulta.data.ativo === false) {
    estado = 'bloqueado';
  } else {
    estado = 'liberado';
  }

  return { estado, recarregar: () => void consulta.refetch() };
}
