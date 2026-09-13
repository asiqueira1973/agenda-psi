import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, spacing, screenMargin } from '@/theme';
import { copyAuth } from '@/features/auth/copy';
import { criarConta, garantirFichaProfissional } from '@/features/auth/auth-service';
import { useSession } from '@/features/auth/session-provider';
import { chaveProfissionalAtual } from '@/features/auth/use-profissional-atual';
import { track, eventos, telas } from '@/lib/analytics';

/**
 * Tela 2 — Nova conta.
 *
 * Serve a dois casos, e é importante que sirva aos dois:
 *
 * 1. cadastro novo, com nome, e-mail, senha e confirmação;
 * 2. **completar o cadastro** de quem já está autenticado mas não tem ficha em
 *    `profissionais` — a situação das contas órfãs de 3.1. Aí o e-mail vem da
 *    sessão, não há senha a definir, e só falta o nome. O app atual leva para
 *    esta tela apenas no fluxo Apple; a regra 6.3, passo 5, manda valer para
 *    todos.
 *
 * Implementa: 6.2, 6.3, 8.2, inventário 10.2 e a copy de 15.2.
 */
export default function NovaContaScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { session } = useSession();

  // Autenticado e sem ficha: só falta o nome (regra 6.3, passo 5).
  const completandoCadastro = !!session;
  const emailDaSessao = session?.user.email ?? '';

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState(emailDaSessao);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhasDiferem = !completandoCadastro && confirmacao.length > 0 && senha !== confirmacao;

  const podeSalvar =
    nome.trim().length > 0 &&
    (completandoCadastro
      ? true
      : email.trim().length > 0 && senha.length > 0 && senha === confirmacao) &&
    !salvando;

  async function aoSalvar() {
    setErro(null);

    if (!completandoCadastro && senha !== confirmacao) {
      setErro(copyAuth.erros.senhasDiferentes);
      return;
    }

    setSalvando(true);
    try {
      if (completandoCadastro && session) {
        // Caminho 2: a conta já existe, falta a ficha. Idempotente.
        await garantirFichaProfissional({
          usuarioId: session.user.id,
          nome,
          email: emailDaSessao,
        });
        await queryClient.invalidateQueries({ queryKey: chaveProfissionalAtual });
        router.replace('/');
        return;
      }

      const { precisaConfirmarEmail } = await criarConta({ nome, email, senha });

      track({
        nome: eventos.contaCriada,
        distinctId: email.trim().toLowerCase(),
        tela: telas.novaConta,
        descricao: 'conta criada',
        propriedades: { sucesso: true },
      });

      if (precisaConfirmarEmail) {
        // O projeto exige confirmação: a ficha só é criada no primeiro login.
        // Guardar o nome não adianta — ele não sobrevive à troca de aparelho —,
        // então o primeiro login volta aqui pelo caminho 2 (regra 6.2).
        router.replace({
          pathname: '/(auth)/confirme-email',
          params: { email: email.trim().toLowerCase() },
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: chaveProfissionalAtual });
      router.replace('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : copyAuth.erros.falhaGenerica);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copyAuth.novaConta.titulo}</Text>
          {completandoCadastro ? (
            <Text color="secondaryLabel" style={{ marginTop: spacing.xs }}>
              Falta só o seu nome para terminar o cadastro.
            </Text>
          ) : null}
        </View>

        <ListGroup
          first
          footer={erro ?? (senhasDiferem ? copyAuth.erros.senhasDiferentes : undefined)}
          footerIsError={!!erro || senhasDiferem}
          style={{ opacity: salvando ? 0.5 : 1 }}
        >
          <FormRow
            label={copyAuth.novaConta.nome}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            autoComplete="name"
            editable={!salvando}
          />
          <RowSeparator />
          <FormRow
            label={copyAuth.novaConta.email}
            value={completandoCadastro ? emailDaSessao : email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!salvando && !completandoCadastro}
          />
          {completandoCadastro ? null : (
            <>
              <RowSeparator />
              <FormRow
                label={copyAuth.novaConta.senha}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!salvando}
              />
              <RowSeparator />
              <FormRow
                label={copyAuth.novaConta.confirmacao}
                value={confirmacao}
                onChangeText={setConfirmacao}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!salvando}
                hasError={senhasDiferem}
              />
            </>
          )}
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={completandoCadastro ? 'Concluir cadastro' : copyAuth.novaConta.criar}
            loadingLabel={copyAuth.novaConta.criando}
            loading={salvando}
            disabled={!podeSalvar}
            onPress={aoSalvar}
          />
        </View>

        {completandoCadastro ? null : (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <Pressable onPress={() => router.back()} accessibilityRole="link">
              <Text style={{ color: colors.accent }}>{copyAuth.novaConta.jaTemConta}</Text>
            </Pressable>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
