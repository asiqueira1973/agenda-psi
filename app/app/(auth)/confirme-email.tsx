import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Icon, Text } from '@/components/ui';
import { useColors, spacing, screenMargin, typography } from '@/theme';
import { copyAuth } from '@/features/auth/copy';
import { supabase } from '@/lib/supabase/client';
import { traduzirErro } from '@/features/auth/auth-service';

/**
 * Tela 3 — Confirme seu e-mail.
 *
 * Não existe no app atual, e essa ausência é o defeito 11.9.10: quando o
 * projeto exige confirmação, o `signUp` volta sem sessão, o app aborta em
 * silêncio, a ficha nunca é criada e a pessoa fica com uma conta órfã que ao
 * logar recebe "Usuário sem acesso ao app".
 *
 * Hoje o "Confirm email" está DESLIGADO no projeto — conferido em 13/09/2026,
 * nenhuma das 365 contas tem `confirmation_sent_at`. Esta tela é contingência:
 * existe porque a configuração pode mudar no painel sem ninguém avisar o app.
 *
 * Sem botão preenchido, como o handoff desenha: as duas ações são texto azul.
 *
 * Implementa: 6.2, 8.2, inventário 10.3 e a copy de 15.2.
 */
export default function ConfirmeEmailScreen() {
  const colors = useColors();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [reenviando, setReenviando] = useState(false);

  async function aoReenviar() {
    if (!email) return;
    setReenviando(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setReenviando(false);
    Alert.alert(
      error ? traduzirErro(error) : copyAuth.confirmeEmail.corpo(email),
    );
  }

  return (
    <Screen>
      <View
        style={{
          alignItems: 'center',
          paddingHorizontal: screenMargin * 2,
          marginTop: spacing.xxxl,
        }}
      >
        <Icon name="envelope" color={colors.systemGray} size={56} />
        <Text style={[typography.title2, { textAlign: 'center', marginTop: spacing.xl }]}>
          {copyAuth.confirmeEmail.titulo}
        </Text>
        <Text color="secondaryLabel" style={{ textAlign: 'center', marginTop: spacing.md }}>
          {copyAuth.confirmeEmail.corpo(email ?? '')}
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxxl }}>
        <Pressable onPress={aoReenviar} disabled={reenviando} accessibilityRole="link">
          <Text style={{ color: colors.accent, opacity: reenviando ? 0.4 : 1 }}>
            {copyAuth.confirmeEmail.reenviar}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="link">
          <Text style={{ color: colors.accent }}>{copyAuth.confirmeEmail.voltar}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
