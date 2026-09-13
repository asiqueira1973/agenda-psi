import { AuthError, type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { copyAuth } from './copy';

/**
 * Operações de autenticação e a criação da ficha em `profissionais`.
 *
 * Separado das telas de propósito: é aqui que mora a regra 6.2, que tem um
 * detalhe fácil de errar — o cadastro são DUAS operações não transacionais, e o
 * app atual erra justamente na segunda.
 *
 * Implementa: 6.1, 6.2, 6.3 e 6.4 do spec, e o épico 8.2.
 */

/**
 * Traduz o erro do Supabase, que vem em inglês, para o texto da seção 15.
 *
 * Critério de aceite do 8.2: "nenhum erro do Supabase aparece cru em inglês".
 * O app atual mostra `Invalid login credentials` e `Passwords don't match!`
 * direto na tela (defeito 11.9.21).
 */
export function traduzirErro(erro: unknown): string {
  if (erro instanceof AuthError) {
    const codigo = erro.code ?? '';
    const mensagem = erro.message.toLowerCase();

    if (codigo === 'invalid_credentials' || mensagem.includes('invalid login credentials')) {
      return copyAuth.erros.credencialIncorreta;
    }
    if (codigo === 'user_already_exists' || mensagem.includes('already registered')) {
      return copyAuth.erros.emailJaCadastrado;
    }
    if (codigo === 'weak_password' || mensagem.includes('password should be at least')) {
      return copyAuth.erros.senhaCurta;
    }
    if (codigo === 'validation_failed' || mensagem.includes('unable to validate email')) {
      return copyAuth.erros.emailInvalido;
    }
    if (mensagem.includes('network') || mensagem.includes('fetch')) {
      return copyAuth.erros.semConexao;
    }
  }

  if (erro instanceof TypeError) {
    // No React Native, falha de rede chega como TypeError de fetch.
    return copyAuth.erros.semConexao;
  }

  return copyAuth.erros.falhaGenerica;
}

/** Entra com e-mail e senha. Devolve a sessão; erro vira exceção traduzida. */
export async function entrar(email: string, senha: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  });
  if (error) throw new Error(traduzirErro(error));
  if (!data.session) throw new Error(copyAuth.erros.falhaGenerica);
  return data.session;
}

/**
 * Cria a ficha do profissional, uma vez só.
 *
 * Idempotente por consulta antes do insert. O app atual não verifica e pode
 * criar linhas duplicadas para o mesmo `usuario_id` (defeito 11.9.10 e o
 * critério de aceite "criar conta duas vezes com o mesmo usuario_id não cria
 * linha duplicada"). O banco também não impede: `profissionais` não tem índice
 * único em `usuario_id` — conferido em 13/09/2026.
 *
 * Recebe: o `usuario_id` do Supabase Auth, o nome e o e-mail.
 * Devolve: nada. Se a ficha já existe, não faz nada.
 *
 * `email` é NOT NULL no banco, e é exatamente o passo que falta nas contas
 * órfãs de 3.1 (regra 6.2).
 */
export async function garantirFichaProfissional(params: {
  usuarioId: string;
  nome: string;
  email: string;
}): Promise<void> {
  const { data: existente, error: erroConsulta } = await supabase
    .from('profissionais')
    .select('id')
    .eq('usuario_id', params.usuarioId)
    .maybeSingle();

  if (erroConsulta) throw new Error(traduzirErro(erroConsulta));
  if (existente) return;

  const { error } = await supabase.from('profissionais').insert({
    usuario_id: params.usuarioId,
    nome: params.nome.trim(),
    email: params.email.trim().toLowerCase(),
  });

  if (error) throw new Error(traduzirErro(error));
}

/**
 * Cria a conta. São duas operações NÃO transacionais, nesta ordem (regra 6.2).
 *
 * Devolve `precisaConfirmarEmail` para a tela saber qual caminho seguir:
 *
 * - sessão volta na hora  → a ficha é criada agora e a pessoa entra;
 * - sessão não volta      → o projeto exige confirmação de e-mail. A tela
 *   "Confirme seu e-mail" aparece e a ficha só é criada no primeiro login.
 *
 * O app atual não trata o segundo caso: aborta em silêncio, a ficha nunca é
 * criada, e a pessoa fica com uma conta órfã que ao logar recebe "Usuário sem
 * acesso ao app" (defeito 11.9.10).
 *
 * Conferido em 13/09/2026: hoje o projeto está com "Confirm email" DESLIGADO —
 * nenhuma das 365 contas tem `confirmation_sent_at`. O segundo caminho é
 * contingência, mas existe porque a configuração pode mudar no painel a
 * qualquer momento, sem ninguém avisar o app.
 */
export async function criarConta(params: {
  nome: string;
  email: string;
  senha: string;
}): Promise<{ precisaConfirmarEmail: boolean }> {
  const email = params.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({ email, password: params.senha });
  if (error) throw new Error(traduzirErro(error));

  if (!data.session) {
    return { precisaConfirmarEmail: true };
  }

  await garantirFichaProfissional({
    usuarioId: data.session.user.id,
    nome: params.nome,
    email,
  });

  return { precisaConfirmarEmail: false };
}

/**
 * Dispara o e-mail de troca de senha.
 *
 * Novidade obrigatória da 6.4: o app atual NÃO tem "esqueci minha senha" na
 * tela de login. Com a reescrita, todo mundo é deslogado na atualização — a
 * sessão do app Flutter vive em SharedPreferences e a do Expo no chaveiro —, e
 * este passa a ser o caminho de quem não lembra a senha.
 *
 * O `redirectTo` é o deep link do app. Quem trata o retorno é
 * use-deep-link-recovery.
 */
export async function enviarEmailDeRecuperacao(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) throw new Error(traduzirErro(error));
}

/** Grava a senha nova. Só funciona com a sessão de recuperação já estabelecida. */
export async function definirNovaSenha(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw new Error(traduzirErro(error));
}

/** Sai da conta e limpa a sessão do chaveiro. */
export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(traduzirErro(error));
}
