import type { Database } from '@/lib/supabase/database.types';

export type PacienteCartao = Database['public']['Views']['v_pacientes_cartao']['Row'];

/**
 * Filtra a lista de pacientes pelo texto da busca.
 *
 * Critério de aceite de 8.4: encontra o termo em QUALQUER posição do nome, sem
 * diferenciar maiúsculas. Ignorar acento vem junto de graça e evita o caso
 * chato de quem digita "jose" e não acha "José".
 *
 * Fica num arquivo próprio, sem importar o cliente do Supabase, por um motivo
 * prático: é função pura, e assim dá para testá-la sem ambiente, sem rede e sem
 * mock. Importá-la de `use-patients` arrastaria o cliente inteiro para dentro
 * do teste.
 *
 * A busca é em memória porque são no máximo 500 pacientes por usuário
 * (requisito 17.7), e ir ao servidor a cada tecla, na rede de um consultório,
 * é a diferença entre buscar e esperar.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

export function filtrarPacientes(
  pacientes: PacienteCartao[],
  busca: string,
): PacienteCartao[] {
  const termo = busca.trim();
  if (termo.length === 0) return pacientes;

  const alvo = normalizar(termo);
  return pacientes.filter((p) => normalizar(p.nome_completo ?? '').includes(alvo));
}
