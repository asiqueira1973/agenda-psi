import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  restorePurchases,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  deepLinkToSubscriptions,
} from 'expo-iap';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { chaveMeuPlano } from '@/features/home/use-dashboard';
import { PRODUTO_PRO_MENSAL, PRECO_DE_REFERENCIA } from './produtos';

/**
 * Compra da assinatura, direto nas lojas.
 *
 * Sem RevenueCat (decisão de 14/09/2026): o app fala com o StoreKit e com o
 * Play Billing pelo `expo-iap`, e o servidor recebe os avisos de cada loja em
 * uma Edge Function própria.
 *
 * A regra de ouro continua intacta, e é o que importa: **o app não concede Pro.**
 * Uma compra bem-sucedida no StoreKit não libera nada por si. O que libera é
 * `assinaturas` virar `pro`, e quem escreve lá é o servidor, depois de validar a
 * assinatura da notificação da loja (spec 11.6 e máquina 12.1).
 *
 * ⚠️ O carimbo do usuário na compra é o ponto mais frágil de todo o fluxo. Sem
 * `appAccountToken` no iOS e `obfuscatedAccountId` no Android, a notificação
 * chega ao servidor sem dizer de quem é a compra, e não há como ligá-la à conta
 * — o dinheiro entra e o Pro não. É o equivalente ao `Purchases.logIn` que o
 * spec exige em 8.11.
 *
 * Implementa: 8.11, máquina 12.1 e o comportamento de 12.3 para webhook atrasado.
 */

export type EstadoDaCompra =
  | { tipo: 'ocioso' }
  | { tipo: 'comprando' }
  | { tipo: 'confirmando' }
  | { tipo: 'confirmada' }
  | { tipo: 'demorou' }
  | { tipo: 'erro'; mensagem: string };

/** Intervalos crescentes de espera pela confirmação, em ms — soma ~2 minutos. */
const ESPERAS = [2000, 3000, 5000, 8000, 12000, 15000, 20000, 25000, 30000];

export function usePurchases() {
  const queryClient = useQueryClient();
  const { usuarioId } = useSession();

  const [conectado, setConectado] = useState(false);
  const [preco, setPreco] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDaCompra>({ tipo: 'ocioso' });
  const cancelado = useRef(false);

  useEffect(() => {
    let vivo = true;

    async function conectar() {
      try {
        await initConnection();
        if (!vivo) return;
        setConectado(true);

        const produtos = await fetchProducts({
          skus: [PRODUTO_PRO_MENSAL],
          type: 'subs',
        });
        if (!vivo) return;

        // `displayPrice` já vem formatado na moeda e no locale da conta da loja.
        // Nunca formate preço de loja à mão: quem define é a App Store.
        const encontrado = produtos?.[0] as { displayPrice?: string } | undefined;
        setPreco(encontrado?.displayPrice ?? null);
      } catch {
        // Sem conexão com a loja o paywall ainda abre, mostrando o preço de
        // referência. O que não pode é a tela ficar em branco.
        if (vivo) setConectado(false);
      }
    }

    void conectar();

    const aoAtualizar = purchaseUpdatedListener(() => {
      // A compra chegou ao aparelho. Isso NÃO libera nada: o que vale é o
      // servidor confirmar. Aqui só se dispara a espera.
      void aguardarConfirmacaoDoServidor();
    });

    const aoFalhar = purchaseErrorListener((erro) => {
      // Compra cancelada pelo usuário fecha sem erro (spec 12.3).
      const cancelou = String(erro?.code ?? '').toLowerCase().includes('cancel');
      setEstado(
        cancelou
          ? { tipo: 'ocioso' }
          : { tipo: 'erro', mensagem: 'Não foi possível concluir a compra. Tente de novo.' },
      );
    });

    return () => {
      vivo = false;
      cancelado.current = true;
      aoAtualizar.remove();
      aoFalhar.remove();
      void endConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Espera o servidor confirmar, em intervalos crescentes, por até ~2 minutos.
   *
   * É o comportamento que a tabela 12.3 do spec descreve para "webhook do
   * RevenueCat atrasado" — que agora é "notificação da loja atrasada", mesmo
   * problema. Depois do tempo, orienta a usar Restaurar compras em vez de
   * deixar a pessoa olhando um spinner eterno.
   */
  const aguardarConfirmacaoDoServidor = useCallback(async () => {
    setEstado({ tipo: 'confirmando' });

    for (const espera of ESPERAS) {
      await new Promise((r) => setTimeout(r, espera));
      if (cancelado.current) return;

      const { data } = await supabase.from('v_meu_plano').select('plano').maybeSingle();
      if (data?.plano === 'pro') {
        await queryClient.invalidateQueries({ queryKey: chaveMeuPlano });

        // Só agora a transação é finalizada. Deixá-la aberta enquanto o servidor
        // não confirma é proposital: a loja reentrega, e a reentrega é a rede de
        // segurança de quem comprou e não recebeu.
        try {
          const pendentes = await getAvailablePurchases();
          for (const compra of pendentes ?? []) {
            await finishTransaction({ purchase: compra, isConsumable: false });
          }
        } catch {
          // Falhar ao finalizar não é problema do usuário: a loja tenta de novo.
        }

        setEstado({ tipo: 'confirmada' });
        return;
      }
    }

    setEstado({ tipo: 'demorou' });
  }, [queryClient]);

  /** Abre o fluxo de compra da loja, carimbado com o id do usuário. */
  const comprar = useCallback(async () => {
    if (!usuarioId) {
      setEstado({ tipo: 'erro', mensagem: 'Entre na sua conta antes de assinar.' });
      return;
    }

    setEstado({ tipo: 'comprando' });
    try {
      await requestPurchase({
        type: 'subs',
        request: {
          // O carimbo. Sem ele a compra não liga na conta (ver o comentário do
          // topo deste arquivo).
          apple: { sku: PRODUTO_PRO_MENSAL, appAccountToken: usuarioId },
          google: { skus: [PRODUTO_PRO_MENSAL], obfuscatedAccountId: usuarioId },
        },
      });
      // O resultado chega pelo purchaseUpdatedListener, não por aqui.
    } catch {
      setEstado({
        tipo: 'erro',
        mensagem: 'Não foi possível abrir a compra. Tente de novo.',
      });
    }
  }, [usuarioId]);

  /** Restaura compras num aparelho novo (critério de aceite de 8.11). */
  const restaurar = useCallback(async (): Promise<'restaurada' | 'nada'> => {
    try {
      await restorePurchases();
      const compras = await getAvailablePurchases();
      if (!compras || compras.length === 0) return 'nada';

      await aguardarConfirmacaoDoServidor();
      return 'restaurada';
    } catch {
      return 'nada';
    }
  }, [aguardarConfirmacaoDoServidor]);

  /** Abre a tela de gerenciar assinatura da própria loja. */
  const gerenciarNaLoja = useCallback(async () => {
    try {
      await deepLinkToSubscriptions({
        skuAndroid: PRODUTO_PRO_MENSAL,
        packageNameAndroid: 'com.dablab.agendapsi',
      });
    } catch {
      // Sem assinatura ativa a loja recusa o deep link. Silêncio é a resposta
      // certa: a tela do plano já diz onde gerenciar.
    }
  }, []);

  return {
    conectado,
    precoExibido: preco ?? PRECO_DE_REFERENCIA,
    estado,
    comprar,
    restaurar,
    gerenciarNaLoja,
    limparEstado: () => setEstado({ tipo: 'ocioso' }),
  };
}

/** Nome da loja da plataforma, para a copy de 15.7. */
export const LOJA = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
