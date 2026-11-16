import { criarApp } from '../src/app.js';
import { lerConfig } from '../src/config.js';

/**
 * Vercel Function única (divergência 1 do plano do épico 1): recebe `/mcp` e o
 * metadata pelos rewrites do vercel.json. Casca fina: toda a lógica está em `src/`,
 * para o código trocar de hospedagem sem reescrita (seção 1).
 */
const app = criarApp(lerConfig());

export default { fetch: app.fetch };
