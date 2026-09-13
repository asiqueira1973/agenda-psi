import { Screen, EmptyState } from '@/components/ui';

/**
 * Tela 28 — Política de privacidade. ESQUELETO; conteúdo no épico 8.10.
 *
 * No app atual ela só é alcançável pela tela de Login. Passa a ter entrada
 * também em Configurações (8.10), e continua acessível de fora da sessão —
 * quem ainda não entrou precisa poder ler antes de criar conta.
 */
export default function PoliticaDePrivacidadeScreen() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="privacy"
        title="Política de privacidade"
        body="O texto integral entra no épico 8.10."
      />
    </Screen>
  );
}
