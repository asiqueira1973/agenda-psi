import { createClient } from '@supabase/supabase-js';
import { createServer } from 'node:http';

/**
 * Proxy SÓ LOCAL para testar o formulário no basic-host do ext-apps (8.2, critério 1).
 *
 * O basic-host chama o servidor direto do navegador, sem `Authorization` e de outra
 * origem. Este proxy fica na porta que ele espera (3001), entra com a CONTA DE TESTE
 * (`TEST_EMAIL`/`TEST_PASSWORD` do .env.local), injeta o token e libera o CORS só para
 * o basic-host (`http://localhost:8080`). O servidor de verdade (porta 3333) continua
 * exigindo token como sempre: nada dele muda por causa deste script. Escuta só em
 * 127.0.0.1, porque injeta o token: ninguém da rede local pode usar a conta de teste.
 */
const ALVO = process.env.MCP_LOCAL_URL ?? 'http://localhost:3333/mcp';
const PORTA = Number(process.env.PROXY_PORT ?? 3001);
const ORIGEM = process.env.BASIC_HOST_ORIGIN ?? 'http://localhost:8080';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_EMAIL!,
  password: process.env.TEST_PASSWORD!,
});
if (error || !data.session) {
  console.error('Não foi possível entrar com a conta de teste.');
  process.exit(1);
}
const token = data.session.access_token;

const cors = {
  'access-control-allow-origin': ORIGEM,
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }
  const pedacos: Buffer[] = [];
  for await (const p of req) pedacos.push(p as Buffer);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string' && !['host', 'origin', 'content-length', 'authorization'].includes(k)) headers[k] = v;
  }
  headers.authorization = `Bearer ${token}`;
  try {
    const r = await fetch(ALVO, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(pedacos),
    });
    res.writeHead(r.status, { ...Object.fromEntries(r.headers), ...cors });
    if (r.body) for await (const p of r.body) res.write(p);
    res.end();
  } catch {
    res.writeHead(502, cors).end();
  }
}).listen(PORTA, '127.0.0.1', () => console.log(`Proxy local da conta de teste em http://localhost:${PORTA}/mcp → ${ALVO}`));
