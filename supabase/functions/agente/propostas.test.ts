import { assertEquals } from 'jsr:@std/assert@1';
import {
  dataValida,
  diaDoNome,
  horaFimPadrao,
  horaValida,
  nomesDePropostas,
  pagamentoDaSessao,
  resolverPaciente,
  valorDoPagamento,
  valorValido,
} from './propostas.ts';

const pacientes = [
  { id: '1', nome: 'Ana Paula Souza', preco_referencia: 250, ativo: true },
  { id: '2', nome: 'Ana Lima', preco_referencia: 300, ativo: false },
  { id: '3', nome: 'Beatriz Nogueira', preco_referencia: 280, ativo: true },
  { id: '4', nome: 'José Lemos', preco_referencia: null, ativo: true },
];

Deno.test('paciente único é resolvido, sem acento e sem caixa', () => {
  const r = resolverPaciente('jose', pacientes);
  assertEquals(r.situacao, 'ok');
  if (r.situacao === 'ok') assertEquals(r.id, '4');
});

Deno.test('duas "Ana" ficam ambíguas, com as ativas primeiro — nunca escolhe sozinho', () => {
  const r = resolverPaciente('Ana', pacientes);
  assertEquals(r.situacao, 'ambiguo');
  if (r.situacao === 'ambiguo') assertEquals(r.opcoes.map((o) => o.id), ['1', '2']);
});

Deno.test('nome inteiro igual vence a busca por palavras', () => {
  const lista = [...pacientes, { id: '5', nome: 'Ana', preco_referencia: 200, ativo: true }];
  const r = resolverPaciente('ana', lista);
  assertEquals(r.situacao === 'ok' && r.id, '5');
});

Deno.test('nome que não existe fica não encontrado', () => {
  assertEquals(resolverPaciente('Helena', pacientes).situacao, 'nao_encontrado');
});

Deno.test('valor do pagamento: frase vence, senão referência, senão nenhum', () => {
  const beatriz = resolverPaciente('beatriz', pacientes);
  assertEquals(valorDoPagamento(250, beatriz), { valor: 250, valor_origem: 'frase' });
  assertEquals(valorDoPagamento(undefined, beatriz), { valor: 280, valor_origem: 'referencia' });
  assertEquals(valorDoPagamento(undefined, resolverPaciente('jose', pacientes)), { valor: null, valor_origem: 'nenhum' });
  assertEquals(valorDoPagamento(undefined, resolverPaciente('ana', pacientes)), { valor: null, valor_origem: 'nenhum' });
});

Deno.test('pagamento da sessão vira o literal do banco (pegadinha 6)', () => {
  assertEquals(pagamentoDaSessao('nao pagou'), 'nao pagou');
  assertEquals(pagamentoDaSessao('mensal'), 'pagamento mensal');
  assertEquals(pagamentoDaSessao(undefined), 'pagamento mensal');
});

Deno.test('dia da semana pelo nome, 1 = segunda (pegadinha 7)', () => {
  assertEquals(diaDoNome('segunda'), 1);
  assertEquals(diaDoNome('Quarta-feira'), 3);
  assertEquals(diaDoNome('sábado'), 6);
  assertEquals(diaDoNome('domingo'), 7);
  assertEquals(diaDoNome('feriado'), null);
});

Deno.test('hora normalizada e fim padrão de 50 minutos', () => {
  assertEquals(horaValida('9:00'), '09:00');
  assertEquals(horaValida('10h'), '10:00');
  assertEquals(horaValida('25:00'), null);
  assertEquals(horaFimPadrao('10:00'), '10:50');
  assertEquals(horaFimPadrao('23:30'), '23:59');
});

Deno.test('datas e valores impossíveis são recusados', () => {
  assertEquals(dataValida('2026-02-30'), null);
  assertEquals(dataValida('2026-11-02'), '2026-11-02');
  assertEquals(valorValido(-10), null);
  assertEquals(valorValido('280,50'), 280.5);
});

Deno.test('todas as propostas começam com propor_ — nenhuma grava', () => {
  assertEquals(nomesDePropostas.every((n) => n.startsWith('propor_')), true);
});
