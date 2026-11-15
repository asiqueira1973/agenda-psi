import { defineConfig } from 'vitest/config';

// Testes em Node puro (spec seção 22): regras, handlers com Supabase simulado e rotas.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
