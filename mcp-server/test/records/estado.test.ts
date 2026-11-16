import { describe, expect, it } from 'vitest';
import type { PreenchimentoDeRegistro } from '../../src/tools/records/tipos.js';
import { estadoInicialDeRegistro, reduzirRegistro } from '../../ui/record/state.js';

const dados = (modo: 'edicao' | 'exclusao'): PreenchimentoDeRegistro => ({
  formulario_id: 'f', acao: 'x', qual: 'x', modo, ferramentaSalvar: 'salvar_x', titulo: 'T', avisos: [], paciente: null, pedido: '{}',
  candidatos: [{ id: 'a', rotulo: 'A', campos: [{ nome: 'valor', rotulo: 'Valor', tipo: 'numero', valor: '1', atual: '1', atualRotulo: 'R$ 1' }] }, { id: 'b', rotulo: 'B', campos: [] }],
  escolhido: null, vazio: '', textos: { salvar: 'Salvar', salvando: 'Salvando...', aviso: null },
});

describe('estado do formulário de registro (12, 8.6)', () => {
  it('exclusão: o primeiro clique só pede a confirmação; Salvar sem confirmar não grava', () => {
    let s = reduzirRegistro(estadoInicialDeRegistro(), { tipo: 'preenchimento', dados: dados('exclusao') });
    expect(reduzirRegistro(s, { tipo: 'salvar_inicio' }).fase).toBe('pronto');
    s = reduzirRegistro(s, { tipo: 'escolher', id: 'a' });
    expect(reduzirRegistro(s, { tipo: 'salvar_inicio' }).fase).toBe('pronto');
    s = reduzirRegistro(s, { tipo: 'pedir_confirmacao' });
    expect(s.fase).toBe('confirmando');
    expect(reduzirRegistro(s, { tipo: 'salvar_inicio' }).fase).toBe('salvando');
  });
  it('edição: valores por registro; falha parcial guarda o "continuar"; sucesso tranca', () => {
    let s = reduzirRegistro(estadoInicialDeRegistro(), { tipo: 'preenchimento', dados: dados('edicao') });
    s = reduzirRegistro(reduzirRegistro(s, { tipo: 'escolher', id: 'a' }), { tipo: 'editar', campo: 'valor', valor: '2' });
    expect(s.valores.a).toEqual({ valor: '2' });
    s = reduzirRegistro(reduzirRegistro(s, { tipo: 'salvar_inicio' }), { tipo: 'salvar_erro', erros: [{ campo: null, mensagem: 'parcial' }], continuar: { novo_id: 'n' } });
    expect([s.fase, s.erroGeral, s.continuar]).toEqual(['pronto', 'parcial', { novo_id: 'n' }]);
    s = reduzirRegistro(reduzirRegistro(s, { tipo: 'salvar_inicio' }), { tipo: 'salvar_ok', titulo: 'ok', resumo: 'r' });
    expect(reduzirRegistro(s, { tipo: 'cancelar' }).fase).toBe('sucesso');
    expect(reduzirRegistro(s, { tipo: 'salvar_inicio' })).toBe(s);
  });
});
