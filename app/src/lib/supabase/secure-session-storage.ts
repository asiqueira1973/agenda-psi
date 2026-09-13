import * as SecureStore from 'expo-secure-store';

/**
 * Guarda a sessão do Supabase no chaveiro do aparelho, partida em pedaços.
 *
 * Por que partir: o expo-secure-store avisa e passa a ser não confiável acima
 * de 2048 bytes por valor, e uma sessão do Supabase com access token, refresh
 * token e o objeto do usuário passa disso com facilidade. Guardar inteiro
 * funciona no simulador e falha no aparelho de alguém — o pior tipo de defeito.
 *
 * Como funciona: o valor é quebrado em pedaços de 1800 caracteres, gravados em
 * `<chave>.0`, `<chave>.1` e assim por diante, com a contagem em `<chave>.n`.
 * Na leitura os pedaços são remontados na ordem. Na escrita, os pedaços que
 * sobraram de um valor maior anterior são apagados — senão uma sessão curta
 * herdaria lixo de uma longa.
 *
 * Implementa: entrega de 8.1 ("cliente Supabase com sessão em expo-secure-store")
 * e o requisito 6.4 de sessão persistida.
 */

/** Folga proposital para baixo do limite de 2048 bytes do SecureStore. */
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === 0) return null;

    const partes = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );

    // Um pedaço faltando significa gravação interrompida: a sessão inteira é
    // lixo e é melhor pedir login de novo do que devolver JSON quebrado.
    if (partes.some((parte) => parte === null)) {
      await secureSessionStorage.removeItem(key);
      return null;
    }

    return partes.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const anterior = await readCount(key);
    const pedacos: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      pedacos.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      pedacos.map((pedaco, i) => SecureStore.setItemAsync(chunkKey(key, i), pedaco)),
    );
    await SecureStore.setItemAsync(countKey(key), String(pedacos.length));

    // Limpa a cauda de uma sessão anterior que era maior que esta.
    if (anterior > pedacos.length) {
      await Promise.all(
        Array.from({ length: anterior - pedacos.length }, (_, i) =>
          SecureStore.deleteItemAsync(chunkKey(key, pedacos.length + i)),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await Promise.all([
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
      SecureStore.deleteItemAsync(countKey(key)),
    ]);
  },
};
