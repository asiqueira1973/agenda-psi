import { Screen, EmptyState } from '@/components/ui';

/**
 * Agente Psi — ESQUELETO. Conteúdo no épico 8.9 do spec.
 *
 * Existe para que a navegação que já aponta para cá não quebre. Trocar por tela
 * de verdade quando o épico 8.9 abrir.
 */
export default function TelaEsqueleto() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="agent"
        title="Agente Psi"
        body="Esta tela entra no épico 8.9."
      />
    </Screen>
  );
}
