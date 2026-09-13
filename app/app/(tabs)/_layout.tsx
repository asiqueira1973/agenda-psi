import { Tabs } from 'expo-router';
import { Icon } from '@/components/ui';
import { useColors, typography } from '@/theme';

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
        tabBarLabelStyle: typography.caption,
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
          title: 'Configurações',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
