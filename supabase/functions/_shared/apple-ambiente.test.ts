import { assertEquals } from 'jsr:@std/assert@1';
import { Buffer } from 'node:buffer';
import { Environment } from 'npm:@apple/app-store-server-library@3';
import { ambienteDoPayload } from './apple-ambiente.ts';

/**
 * Monta um JWS de mentira, com o corpo em base64url como a Apple manda.
 * A assinatura é lixo de propósito: esta função não verifica nada.
 */
function jwsFalso(corpo: unknown): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'ES256' })}.${b64url(corpo)}.assinatura`;
}

Deno.test('sandbox é reconhecido — o caso do TestFlight', () => {
  const jws = jwsFalso({ notificationType: 'SUBSCRIBED', data: { environment: 'Sandbox' } });
  assertEquals(ambienteDoPayload(jws), Environment.SANDBOX);

  // A prova de que o jeito antigo não servia: a palavra não está em texto claro.
  assertEquals(jws.includes('Sandbox'), false);
});

Deno.test('produção é reconhecida', () => {
  const jws = jwsFalso({ notificationType: 'DID_RENEW', data: { environment: 'Production' } });
  assertEquals(ambienteDoPayload(jws), Environment.PRODUCTION);
});

Deno.test('na dúvida, produção', () => {
  assertEquals(ambienteDoPayload(jwsFalso({ notificationType: 'TEST' })), Environment.PRODUCTION);
  assertEquals(ambienteDoPayload('nao.é.jws'), Environment.PRODUCTION);
  assertEquals(ambienteDoPayload(''), Environment.PRODUCTION);
});
