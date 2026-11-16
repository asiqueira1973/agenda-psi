import { describe, expect, it } from 'vitest';
import { anotacaoDe } from '../src/tools/anotacoes.js';

describe('anotações das ferramentas (13.1, requisito do diretório)', () => {
  it('escrita é destrutiva e tem título pela ação; leitura usa a tabela ou o título do formulário', () => {
    expect(anotacaoDe('salvar_exclusao_sessao', undefined)).toEqual({ title: 'Salvar exclusão de sessão', escrita: true });
    expect(anotacaoDe('registrar_despesa', undefined)).toEqual({ title: 'Registrar despesa sem formulário', escrita: true });
    expect(anotacaoDe('agenda_da_semana', undefined)).toEqual({ title: 'Agenda da semana', escrita: false });
    expect(anotacaoDe('abrir_formulario_paciente', 'Novo paciente')).toEqual({ title: 'Novo paciente', escrita: false });
  });
  it('ferramenta nova sem título conhecido não passa', () => {
    expect(anotacaoDe('ferramenta_nova', undefined)).toBeNull();
    expect(anotacaoDe('salvar_coisa_nova', undefined)).toBeNull();
  });
});

describe('nenhum texto ao modelo diz como ele deve responder (requisito do diretório)', () => {
  it('abertura só descreve o estado', async () => {
    const { textosNovosEpico5 } = await import('../src/rules/copy-app.js');
    const { textosParaOModelo } = await import('../src/rules/messages.js');
    for (const t of [textosNovosEpico5.formularioAberto('sessão'), textosParaOModelo.formularioAberto]) expect(t).not.toMatch(/Responda|nada mais/);
  });
});
