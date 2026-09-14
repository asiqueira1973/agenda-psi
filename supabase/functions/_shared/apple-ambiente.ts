import { Buffer } from 'node:buffer';
import { Environment } from 'npm:@apple/app-store-server-library@3';

/**
 * Descobre se a notificação da Apple é de sandbox ou de produção, lendo o corpo
 * do JWS SEM verificar a assinatura.
 *
 * Ler dado não verificado parece errado, e seria — se algo fosse decidido a
 * partir dele. Não é: o ambiente apenas escolhe contra QUAL cadeia de
 * certificados a Apple vai ser conferida logo em seguida. Quem mentir aqui só
 * faz a própria verificação falhar. Nenhum campo deste JSON chega ao banco;
 * tudo que é gravado vem do payload já verificado.
 *
 * O verificador precisa do ambiente de antemão, e o campo que diz o ambiente
 * mora dentro do próprio payload assinado — daí o ovo e a galinha.
 *
 * **Sem isto, todo teste de TestFlight volta 401**: compra em TestFlight é
 * sempre sandbox. A tentativa anterior era `signedPayload.includes('Sandbox')`,
 * que nunca acerta: o payload é base64, e a palavra não aparece em texto claro.
 *
 * Implementa: parte da máquina 12.1 (entrada das notificações da loja).
 *
 * @param jws o `signedPayload` como veio no corpo da requisição
 * @returns o ambiente a usar na verificação; produção quando não dá para saber
 */
export function ambienteDoPayload(jws: string): Environment {
  try {
    const corpo = jws.split('.')[1];
    if (!corpo) return Environment.PRODUCTION;
    // base64url → base64 antes de decodificar.
    const texto = Buffer.from(
      corpo.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const dados = JSON.parse(texto);
    const ambiente = dados?.data?.environment ?? dados?.externalPurchaseToken?.environment;
    return ambiente === 'Sandbox' ? Environment.SANDBOX : Environment.PRODUCTION;
  } catch {
    // Payload ilegível não é decisão nossa: deixa a verificação recusar.
    return Environment.PRODUCTION;
  }
}
