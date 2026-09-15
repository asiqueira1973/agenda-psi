import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  FilledButton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { useProfissionalAtual } from '@/features/auth/use-profissional-atual';
import { useAtualizarPerfil } from '@/features/settings/use-settings';
import { copyConfiguracoes } from '@/features/settings/copy';
import { copyAuth } from '@/features/auth/copy';
import { validarNome } from '@/lib/validation';

/**
 * Tela 22 — Meu perfil.
 *
 * Lê de `v_profissional_atual`, do banco, e não do estado global do app. É a
 * correção de 8.10: hoje esta tela mostra o cache local, então qualquer coisa
 * alterada fora do app aparece defasada aqui — e o usuário vê um dado errado
 * sem ter como saber que está errado.
 *
 * Implementa: 8.10 e o inventário 10.22.
 */
export default function MeuPerfilScreen() {
  const colors = useColors();
  const perfil = useProfissionalAtual();
  const atualizar = useAtualizarPerfil();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [carregou, setCarregou] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregou || !perfil.data) return;
    setNome(perfil.data.nome ?? '');
    setTelefone(perfil.data.telefone ?? '');
    setLinkedin(perfil.data.linkedin ?? '');
    setInstagram(perfil.data.instagram ?? '');
    setCarregou(true);
  }, [perfil.data, carregou]);

  const validacao = validarNome(nome);

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    if (!validacao.valido) return;

    atualizar.mutate(
      {
        nome,
        telefone: telefone.trim() || null,
        linkedin: linkedin.trim() || null,
        instagram: instagram.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyConfiguracoes.perfil.sucesso);
          router.back();
        },
        onError: () => setErro(copyAuth.erros.falhaGenerica),
      },
    );
  }

  if (perfil.isPending) {
    return (
      <Screen>
        <SkeletonGroup rows={4} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <BackLink label="‹ Ajustes" />
          <Text variant="largeTitle">{copyConfiguracoes.perfil.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={erro ?? (tentouSalvar && !validacao.valido ? validacao.mensagem : undefined)}
          footerIsError={!!erro || (tentouSalvar && !validacao.valido)}
        >
          <FormRow
            label={copyConfiguracoes.perfil.nome}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            hasError={tentouSalvar && !validacao.valido}
            editable={!atualizar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyConfiguracoes.perfil.telefone}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            editable={!atualizar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyConfiguracoes.perfil.linkedin}
            value={linkedin}
            onChangeText={setLinkedin}
            autoCapitalize="none"
            editable={!atualizar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyConfiguracoes.perfil.instagram}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            editable={!atualizar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyConfiguracoes.perfil.salvar}
            loadingLabel={copyConfiguracoes.perfil.salvando}
            loading={atualizar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
