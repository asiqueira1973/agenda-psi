import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente do TanStack Query — o estado de servidor do app inteiro.
 *
 * Implementa: 4.1 (escolha da stack), 8.1, 17.2 (tempo de resposta de lista) e
 * 17.3 (leitura offline com aviso de desatualizado).
 *
 * É este cache que resolve, de graça, dois defeitos do app atual: lista que não
 * recarrega depois de uma escrita (11.9.14 e o caso do detalhe do paciente,
 * 11.9.11) e tela sem estado de carregamento ou de erro (11.9.12, princípio P3).
 * A regra que vem junto: depois de toda escrita, invalide a query afetada. Nada
 * de `setState` à mão com o valor que você acabou de mandar para o banco.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Alvo de 17.2: lista abre em até 200 ms quando há cache. Meio minuto é o
      // bastante para o ir e vir entre telas não refazer a consulta, e curto o
      // suficiente para o dado do mês não envelhecer na mão do usuário.
      staleTime: 30_000,
      // Mantém o cache por 24h para a leitura offline de 17.3: tela já visitada
      // abre com o que tem e avisa que está desatualizada.
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      // Sem rede, tentar de novo só gasta bateria e atrasa a mensagem de erro.
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Escrita não se repete sozinha: repetir um insert de pagamento cria dois
      // pagamentos. O usuário decide se tenta de novo (spec 12.3).
      retry: 0,
      networkMode: 'online',
    },
  },
});
