import { Platform } from 'react-native';
import type { ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { size } from '@/theme';

/**
 * Ícone do app, com o símbolo de cada plataforma.
 *
 * O handoff diz, em "Fidelity" e em "Assets", que os SVGs dos protótipos são
 * marcadores de posição e que o app usa SF Symbols no iOS e Material Symbols no
 * Android. Este componente é o lugar onde esse par vive: a tela pede um nome de
 * papel — `paciente`, `excluir` —, não um nome de símbolo de plataforma.
 *
 * Trocar de ícone é editar o registro abaixo, num arquivo só. A escolha exata
 * de cada símbolo é livre (spec 16.7), desde que o par faça sentido nos dois
 * sistemas.
 */

type IconPair = { ios: string; android: keyof typeof MaterialIcons.glyphMap };

const icons = {
  home: { ios: 'house.fill', android: 'home' },
  schedule: { ios: 'calendar', android: 'calendar-today' },
  patients: { ios: 'person.2.fill', android: 'people' },
  expenses: { ios: 'creditcard.fill', android: 'credit-card' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  profile: { ios: 'person.crop.circle', android: 'account-circle' },
  password: { ios: 'lock', android: 'lock' },
  plan: { ios: 'star.circle', android: 'stars' },
  feedback: { ios: 'bubble.left', android: 'chat-bubble-outline' },
  privacy: { ios: 'hand.raised', android: 'privacy-tip' },
  add: { ios: 'plus', android: 'add' },
  chevron: { ios: 'chevron.right', android: 'chevron-right' },
  back: { ios: 'chevron.left', android: 'arrow-back' },
  check: { ios: 'checkmark', android: 'check' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  session: { ios: 'square.and.pencil', android: 'edit-note' },
  payment: { ios: 'brazilianrealsign.circle', android: 'payments' },
  price: { ios: 'tag', android: 'sell' },
  receipt: { ios: 'doc.plaintext', android: 'receipt-long' },
  envelope: { ios: 'envelope', android: 'mail-outline' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility-off' },
  send: { ios: 'arrow.up.circle.fill', android: 'send' },
  search: { ios: 'magnifyingglass', android: 'search' },
  delete: { ios: 'trash', android: 'delete-outline' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
} as const satisfies Record<string, IconPair>;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  color: ColorValue;
  /** Padrão: 21pt, a medida de ícone em linha de lista (handoff). */
  size?: number;
};

export function Icon({ name, color, size: iconSize = size.rowIcon }: Props) {
  const pair = icons[name];

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={pair.ios as never}
        tintColor={color}
        size={iconSize}
        resizeMode="scaleAspectFit"
      />
    );
  }

  return <MaterialIcons name={pair.android} size={iconSize} color={color as string} />;
}
