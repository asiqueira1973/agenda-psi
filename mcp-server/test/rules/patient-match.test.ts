import { describe, expect, it } from 'vitest';
import { resolverPaciente } from '../../src/rules/patient-match.js';

// Mesmos casos de supabase/functions/agente/propostas.test.ts (regra 11.14).
const pacientes = [
  { id: '1', nome: 'Ana Paula Souza', preco_referencia: 250, ativo: true },
  { id: '2', nome: 'Ana Lima', preco_referencia: 300, ativo: false },
  { id: '3', nome: 'Beatriz Nogueira', preco_referencia: 280, ativo: true },
  { id: '4', nome: 'José Lemos', preco_referencia: null, ativo: true },
];

describe('resolverPaciente (regra 11.14)', () => {
  it('ok: um só, sem acento e sem caixa', () => {
    expect(resolverPaciente('jose', pacientes)).toEqual({
      situacao: 'ok', id: '4', nome: 'José Lemos', preco_referencia: null,
    });
  });

  it('ambíguo: duas "Ana", ativas primeiro, nunca escolhe sozinho', () => {
    const r = resolverPaciente('Ana', pacientes);
    expect(r.situacao).toBe('ambiguo');
    if (r.situacao === 'ambiguo') {
      expect(r.opcoes.map((o) => o.id)).toEqual(['1', '2']);
      expect(r.opcoes[0]).not.toHaveProperty('ativo');
    }
  });

  it('não encontrado', () => {
    expect(resolverPaciente('Helena', pacientes)).toEqual({ situacao: 'nao_encontrado', termo: 'Helena' });
    expect(resolverPaciente('   ', pacientes).situacao).toBe('nao_encontrado');
  });

  it('nome inteiro igual vence a busca por palavras', () => {
    const lista = [...pacientes, { id: '5', nome: 'Ana', preco_referencia: 200, ativo: true }];
    const r = resolverPaciente('ana', lista);
    expect(r.situacao === 'ok' && r.id).toBe('5');
  });

  it('todas as palavras precisam estar no nome', () => {
    const r = resolverPaciente('ana souza', pacientes);
    expect(r.situacao === 'ok' && r.id).toBe('1');
  });

  it('ambíguo devolve no máximo 8 opções', () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({ id: String(i), nome: `Helena ${i}`, preco_referencia: null, ativo: true }));
    const r = resolverPaciente('helena', muitas);
    expect(r.situacao === 'ambiguo' && r.opcoes.length).toBe(8);
  });
});
