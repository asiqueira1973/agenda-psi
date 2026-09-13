import { Screen, EmptyState } from '@/components/ui';

/**
 * Novo paciente — ESQUELETO. Conteúdo no épico 8.4 do spec.
 *
 * Existe para que a navegação que já aponta para cá não quebre. Trocar por tela
 * de verdade quando o épico 8.4 abrir.
 */
export default function TelaEsqueleto() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="patients"
        title="Novo paciente"
        body="Esta tela entra no épico 8.4."
      />
    </Screen>
  );
}
