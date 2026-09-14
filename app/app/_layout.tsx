import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from '@/lib/query';
import { SessionProvider } from '@/features/auth/session-provider';

/**
 * Raiz do app: providers e a pilha de navegação de nível mais alto.
 *
 * Ordem dos providers, e o porquê de cada um estar onde está:
 * - GestureHandlerRootView por fora de tudo: sem ela o deslize de exclusão
 *   da lista de pacientes não responde, e falha em silêncio;
 * - SafeAreaProvider em seguida, porque todo o resto mede a área segura;
 * - QueryClientProvider antes da sessão, porque as queries de 6.3 rodam assim
 *   que há sessão;
 * - SessionProvider por último, já podendo usar o cache.
 *
 * A barra de status é `auto`: clara no fundo escuro, escura no claro. Modo
 * escuro é obrigatório e segue o aparelho (spec 16.6).
 *
 * Implementa: 8.1 (fundação) e 8.3 (estrutura de navegação).
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              // Folha modal é o padrão das telas de formulário curto do app
              // (handoff, "Folha modal"); cada rota declara a sua.
              animation: 'default',
            }}
          />
        </SessionProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
