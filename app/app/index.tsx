import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen, ErrorState } from '@/components/ui';
import { useColors } from '@/theme';
import { useSession } from '@/features/auth/session-provider';
import { useEstadoDeAcesso } from '@/features/auth/use-profissional-atual';
import { useDeepLinkRecovery } from '@/features/auth/use-deep-link-recovery';
import { sair } from '@/features/auth/auth-service';
import { copyAuth } from '@/features/auth/copy';

/**
 * Guardião da raiz — decide para onde o app abre.
 *
 * É aqui que a regra 6.3 acontece, e ela é mais do que "tem sessão?":
 * autenticar no Supabase não basta. Depois do login, consulta-se
 * `v_profissional_atual` e:
 *
 * - ficha existe e está ativa (ou `ativo` é NULO, que significa ativa) → entra;
 * - ficha existe e `ativo = false` → alerta bloqueante, `signOut` e volta para
 *   o login. É assim que a exclusão de conta funciona de verdade (6.4);
 * - não existe ficha → Nova conta, para completar o cadastro. O app atual só
 *   faz isso no fluxo Apple; aqui vale para todos.
 *
 * O link de recuperação de senha tem precedência sobre tudo: se o app foi
 * aberto por ele, o destino é a tela de nova senha, mesmo que haja sessão.
 *
 * Implementa: 6.3, 6.4, 8.2 e 8.3.
 */
export default function Index() {
  const colors = useColors();
  const { session } = useSession();
  const { estado, recarregar } = useEstadoDeAcesso();
  const recuperacao = useDeepLinkRecovery();
  const jaAvisouDoBloqueio = useRef(false);

  useEffect(() => {
    if (estado !== 'bloqueado' || jaAvisouDoBloqueio.current) return;

    // Uma vez só: sem a trava, o alerta reaparece a cada render enquanto o
    // signOut não termina de propagar.
    jaAvisouDoBloqueio.current = true;
    Alert.alert('Conta desativada', copyAuth.erros.contaDesativada, [
      { text: 'OK', onPress: () => void sair() },
    ]);
  }, [estado]);

  if (recuperacao.tipo === 'pronta') {
    return <Redirect href="/(auth)/nova-senha" />;
  }

  if (recuperacao.tipo === 'falhou') {
    // O link morreu. Cai no login, onde existe "Esqueci minha senha" para
    // pedir outro — e avisa, em vez de deixar a pessoa achando que o app
    // ignorou o e-mail dela.
    Alert.alert(recuperacao.mensagem);
    return <Redirect href="/(auth)/login" />;
  }

  if (estado === 'carregando' || recuperacao.tipo === 'trocando') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.systemGray as string} />
        </View>
      </Screen>
    );
  }

  if (estado === 'erro') {
    return (
      <Screen scroll={false}>
        <ErrorState onRetry={recarregar} />
      </Screen>
    );
  }

  if (estado === 'liberado') {
    return <Redirect href="/(tabs)" />;
  }

  if (estado === 'bloqueado') {
    return <Redirect href="/(auth)/login" />;
  }

  // Sem ficha: autenticado vai completar o cadastro, anônimo vai para o login.
  return <Redirect href={session ? '/(auth)/nova-conta' : '/(auth)/login'} />;
}
