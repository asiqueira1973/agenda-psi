import { Stack } from 'expo-router';

/**
 * Pilha das telas de autenticação. Sem abas e sem cabeçalho do sistema — cada
 * tela desenha o próprio large title, como manda o handoff.
 *
 * Implementa: 8.2 e o inventário de telas 1 a 4 da seção 10.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
