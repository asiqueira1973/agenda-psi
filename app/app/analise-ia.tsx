import { Screen, EmptyState } from '@/components/ui';

/**
 * Análise com IA — ESQUELETO. Conteúdo no épico 8.3 do spec.
 *
 * Existe para que a navegação que já aponta para cá não quebre. Trocar por tela
 * de verdade quando o épico 8.3 abrir.
 */
export default function TelaEsqueleto() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="agent"
        title="Análise com IA"
        body="Esta tela entra no épico 8.3."
      />
    </Screen>
  );
}
