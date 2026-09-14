import { Tabs } from 'expo-router';
import { Icon } from '@/components/ui';
import { useColors, tabBarLabel } from '@/theme';

/**
 * As cinco abas: Início, Agenda, Pacientes, Despesas, Configurações.
 *
 * Mudança em relação ao app atual: eram SEIS. A quinta era Locais de
 * atendimento, que saiu do MVP (spec 3) — e com ela morreu o defeito 11.9.20,
 * o rótulo dessa aba que dizia "Pacientes" por erro de cópia.
 *
 * Correção que permanece: os rótulos APARECEM. Hoje estão ocultos, e cinco
 * ícones sem rótulo obrigam a decorar (assunção 24.13). O rótulo escondido da
 * aba 5 estava errado há tempos justamente porque ninguém o via.
 *
 * Implementa: 8.3 e o inventário da seção 10.
 */
export default function TabsLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent as string,
        tabBarInactiveTintColor: colors.systemGray as string,
        tabBarLabelStyle: tabBarLabel,
        // A barra precisa da cor declarada: sem isto ela usa o tema padrão do
        // React Navigation, que é claro, e fica uma faixa branca no pé de um app
        // em modo escuro. Verificado no simulador em 14/09/2026.
        tabBarStyle: {
          backgroundColor: colors.listSurface as string,
          borderTopColor: colors.separator as string,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => <Icon name="schedule" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="pacientes"
        options={{
          title: 'Pacientes',
          tabBarIcon: ({ color }) => <Icon name="patients" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="despesas"
        options={{
          title: 'Despesas',
          tabBarIcon: ({ color }) => <Icon name="expenses" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{
          // "Configurações" não cabe em 80pt de aba, nem em 10pt: trunca para
          // "Configuraçõ...". "Ajustes" é como o próprio iOS chama esse app em
          // português, cabe em qualquer tamanho de Dynamic Type, e rótulo de
          // aba mais curto que o título da tela é padrão do sistema — o título
          // da tela continua "Configurações". Verificado no simulador em
          // 14/09/2026. Adaptação do handoff, decisão de 13/09/2026.
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
