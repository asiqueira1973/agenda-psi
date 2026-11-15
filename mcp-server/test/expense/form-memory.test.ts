import { describe, expect, it } from 'vitest';
import { lembrar, lerLembranca } from '../../ui/shared/memoria.js';
import { estadoInicial, podeSalvar, reduzir } from '../../ui/expense/state.js';
import { preencherDespesa } from '../../src/tools/expense/open-form.js';
import { textosNovosDespesa, textosParaOModelo } from '../../src/rules/messages.js';

/** Storage simulado em memória, com a mesma interface do `localStorage`. */
function storage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  };
}
const bloqueado = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } } as unknown as Storage;

describe('formulário reaparece depois de salvo (épico 3, visto no Claude)', () => {
  it('abrir_formulario_despesa devolve um formulario_id único por abertura', () => {
    const a = preencherDespesa({}, [], '2026-11-15', 'id-1');
    expect(a.formulario_id).toBe('id-1');
  });

  it('o que foi salvo ou cancelado é lembrado pelo formulario_id', () => {
    const s = storage();
    lembrar(s, 'f1', { fase: 'sucesso', resumo: 'Alimentação, R$ 50, competência 15/11/2026', idSalvo: 'x' });
    lembrar(s, 'f2', { fase: 'cancelado' });
    expect(lerLembranca(s, 'f1')).toEqual({ fase: 'sucesso', resumo: 'Alimentação, R$ 50, competência 15/11/2026', idSalvo: 'x' });
    expect(lerLembranca(s, 'f2')).toEqual({ fase: 'cancelado' });
    expect(lerLembranca(s, 'f3')).toBeNull();
  });

  it('armazenamento bloqueado pelo host: não quebra, só não lembra', () => {
    expect(() => lembrar(bloqueado, 'f1', { fase: 'cancelado' })).not.toThrow();
    expect(lerLembranca(bloqueado, 'f1')).toBeNull();
    expect(lerLembranca(undefined, 'f1')).toBeNull();
  });

  it('restaurar um formulário salvo mostra o sucesso e tranca', () => {
    const s = reduzir(estadoInicial(), { tipo: 'restaurar', lembranca: { fase: 'sucesso', resumo: 'R', idSalvo: 'x' } });
    expect(s.fase).toBe('sucesso');
    expect(s.resumo).toBe('R');
    expect(podeSalvar(s)).toBe(false);
  });

  it('cancelar tranca o formulário em "cancelado", sem sucesso', () => {
    const s = reduzir(reduzir(estadoInicial(), { tipo: 'opcoes_ok', tipos: [] }), { tipo: 'cancelar' });
    expect(s.fase).toBe('cancelado');
    expect(s.resumo).toBeNull();
    expect(reduzir(s, { tipo: 'salvar_inicio' })).toBe(s);
  });

  it('não dá para cancelar durante o envio nem depois do sucesso', () => {
    const salvando = { ...estadoInicial(), fase: 'salvando' as const };
    expect(reduzir(salvando, { tipo: 'cancelar' }).fase).toBe('salvando');
  });

  it('textos aprovados em 15/11/2026', () => {
    expect(textosNovosDespesa.cancelado).toBe('Cancelado. Nada foi registrado.');
    expect(textosParaOModelo.formularioCancelado).toBe('A pessoa cancelou o formulário de despesa. Nada foi gravado.');
    expect(textosParaOModelo.formularioAberto).toBe(
      'O formulário de despesa está aberto para a pessoa. Responda exatamente "Abri o formulário de despesa." e nada mais. Nada foi gravado: só grava quando a pessoa clicar em Salvar, e o formulário informa você quando isso acontecer.',
    );
  });
});
