import { Screen, EmptyState } from '@/components/ui';

/**
 * Meu plano — ESQUELETO. Conteúdo no épico 8.11 do spec.
 *
 * Existe para que a navegação que já aponta para cá não quebre. Trocar por tela
 * de verdade quando o épico 8.11 abrir.
 */
export default function TelaEsqueleto() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="plan"
        title="Meu plano"
        body="Esta tela entra no épico 8.11."
      />
    </Screen>
  );
}
