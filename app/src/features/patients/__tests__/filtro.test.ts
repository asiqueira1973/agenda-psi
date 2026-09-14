import { filtrarPacientes, type PacienteCartao } from '../filtro';

/**
 * Teste do critério de aceite de 8.4: "Buscar 'ana' retorna pacientes com 'ana'
 * em qualquer posição do nome, sem diferenciar maiúsculas."
 */

function paciente(nome: string): PacienteCartao {
  return {
    email: null,
    nome_completo: nome,
    observacoes: null,
    paciente_id: nome,
    preco_vigente: null,
    preco_vigente_desde: null,
    primeira_consulta: null,
    receber_sms: null,
    sessoes_nao_pagas: null,
    sessoes_realizadas: null,
    status: 'ativo',
    telefone: null,
    total_sessoes_ate_hoje: null,
    ultima_sessao: null,
    usuario_id: null,
    valor_total_pago_ate_hoje: null,
  };
}

const lista = [
  paciente('Ana Prado'),
  paciente('Mariana Silva'),
  paciente('João Martins'),
  paciente('JOSÉ ANTUNES'),
  paciente('Fernanda Souza'),
];

describe('filtrarPacientes — critério de aceite de 8.4', () => {
  it('encontra no começo do nome', () => {
    expect(filtrarPacientes(lista, 'ana').map((p) => p.nome_completo)).toContain('Ana Prado');
  });

  it('encontra no MEIO do nome, não só no começo', () => {
    expect(filtrarPacientes(lista, 'ana').map((p) => p.nome_completo)).toContain(
      'Mariana Silva',
    );
  });

  it('não diferencia maiúsculas', () => {
    expect(filtrarPacientes(lista, 'ANA')).toHaveLength(
      filtrarPacientes(lista, 'ana').length,
    );
  });

  it('ignora acento: buscar "jose" encontra "JOSÉ"', () => {
    expect(filtrarPacientes(lista, 'jose').map((p) => p.nome_completo)).toContain(
      'JOSÉ ANTUNES',
    );
  });

  it('busca vazia devolve a lista inteira', () => {
    expect(filtrarPacientes(lista, '')).toHaveLength(lista.length);
    expect(filtrarPacientes(lista, '   ')).toHaveLength(lista.length);
  });

  it('busca sem resultado devolve lista vazia, não a lista toda', () => {
    expect(filtrarPacientes(lista, 'zzzz')).toHaveLength(0);
  });
});
