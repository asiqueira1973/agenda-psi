import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { criarApp } from '../src/app.js';
import { lerConfig } from '../src/config.js';

/**
 * Servidor local de desenvolvimento (8.1): converte o request do `node:http` em
 * `Request` web-standard, chama o mesmo `app.fetch` da Vercel e devolve a resposta,
 * inclusive em streaming (SSE). Só local; o deploy usa api/index.ts.
 */
const config = lerConfig();
const app = criarApp(config);
// 3333, e não 3000: a 3000 costuma estar ocupada por outros projetos desta máquina.
const porta = Number(process.env.PORT ?? 3333);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${porta}`}`);
    const headers = new Headers();
    for (const [nome, valor] of Object.entries(req.headers)) {
      if (Array.isArray(valor)) valor.forEach((v) => headers.append(nome, v));
      else if (valor !== undefined) headers.set(nome, valor);
    }
    const temCorpo = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url, {
      method: req.method ?? 'GET',
      headers,
      body: temCorpo ? (Readable.toWeb(req) as ReadableStream) : undefined,
      duplex: 'half',
    } as RequestInit);

    const resposta = await app.fetch(request);
    res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
    if (resposta.body) {
      for await (const pedaco of resposta.body) res.write(pedaco);
    }
    res.end();
  } catch (erro) {
    // Sem detalhes na resposta; o erro fica só no terminal local.
    console.error(erro);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
})
  .on('error', (erro: NodeJS.ErrnoException) => {
    console.error(erro.code === 'EADDRINUSE' ? `A porta ${porta} está ocupada. Rode com PORT=<outra> npm run dev.` : erro);
    process.exit(1);
  })
  .listen(porta, () => {
  console.log(`Servidor MCP local em http://localhost:${porta}/mcp`);
  if (config.devAllowSessionToken) console.log('MCP_DEV_ALLOW_SESSION_TOKEN=1: aceitando token de sessão sem client_id (só local).');
});
