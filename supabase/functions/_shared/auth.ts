import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Identifica o usuário pelo JWT do cabeçalho Authorization.
 *
 * É AQUI que mora a correção da decisão D3 e do defeito 11.9.17. Hoje o app
 * chama webhooks do n8n sem autenticação nenhuma, e o pior deles, `AgentePsi`,
 * recebe o `usuario_id` NO CORPO da requisição. Qualquer pessoa com a URL — que
 * está no bundle do app publicado — lê e escreve dado de qualquer psicólogo
 * trocando um uuid. Isso é falha de autorização direta a objeto sobre dado de
 * saúde.
 *
 * A regra desta função, e das três que a usam: **o usuario_id vem do token,
 * nunca do corpo**. Não é uma verificação a mais; é o corpo não ter esse campo.
 *
 * Devolve: o id do usuário e um cliente Supabase agindo COMO ele, de modo que
 * toda leitura passa pelas 68 policies. Nenhuma função usa service_role.
 */
export async function identificarUsuario(
  req: Request,
): Promise<{ usuarioId: string; cliente: SupabaseClient } | null> {
  const autorizacao = req.headers.get('Authorization');
  if (!autorizacao?.startsWith('Bearer ')) return null;

  const cliente = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacao } } },
  );

  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user) return null;

  return { usuarioId: data.user.id, cliente };
}
