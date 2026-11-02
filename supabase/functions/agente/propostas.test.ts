import { assertEquals } from 'jsr:@std/assert@1';
import {
  dataValida,
  diaDoNome,
  horaFimPadrao,
  horaValida,
  proporFeedback,
  aplicarEdicao,
  camposAlterados,
  resolverHorario,
  somarMinutos,
  duracaoEmMinutos,
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

Deno.test('feedback vira rascunho com categoria; mensagem vazia é recusada', () => {
  const r = proporFeedback({ categoria: 'sugestao', mensagem: ' Queria ver a agenda do mês. ' });
  assertEquals('rascunho' in r && r.rascunho, { tipo: 'feedback', categoria: 'sugestao', mensagem: 'Queria ver a agenda do mês.' });
  const semCategoria = proporFeedback({ mensagem: 'O app fechou' });
  assertEquals('rascunho' in semCategoria && semCategoria.rascunho.tipo === 'feedback' && semCategoria.rascunho.categoria, 'problema');
  assertEquals('erro' in proporFeedback({ categoria: 'problema', mensagem: '  ' }), true);
});

const horariosDoTomas = [
  { id: 'h1', dia_semana: 3, hora_inicio: '09:00', hora_fim: '09:50' },
  { id: 'h2', dia_semana: 5, hora_inicio: '09:00', hora_fim: '09:50' },
];

Deno.test('horário atual pelo dia dito', () => {
  const r = resolverHorario(horariosDoTomas, 3, null);
  assertEquals(r?.situacao === 'ok' && r.id, 'h1');
});

Deno.test('dois horários e a frase não diz qual: ambíguo, o cartão pergunta', () => {
  const r = resolverHorario(horariosDoTomas, null, '09:00');
  assertEquals(r?.situacao, 'ambiguo');
});

Deno.test('o que foi dito não casa com nenhum: mostra todos para escolher', () => {
  const r = resolverHorario(horariosDoTomas, 1, null);
  assertEquals(r?.situacao === 'ambiguo' && r.opcoes.length, 2);
});

Deno.test('paciente sem horário: nada a trocar', () => {
  assertEquals(resolverHorario([], 3, null), null);
});

Deno.test('a troca mantém a duração atual', () => {
  assertEquals(duracaoEmMinutos('09:00', '09:50'), 50);
  assertEquals(somarMinutos('10:00', 50), '10:50');
});

const cadastro = {
  nome: 'Tomás Ribeiro',
  telefone: '11 90000-0000',
  email: 'tomas@x.com',
  observacoes: 'prefere manhã',
  status: 'ativo' as const,
  receber_sms: true,
  preco: 250,
};

Deno.test('edição muda só o que foi pedido e preserva as observações', () => {
  const novo = aplicarEdicao(cadastro, { telefone: '11 98888-7777', receber_sms: false });
  assertEquals(novo.observacoes, 'prefere manhã');
  assertEquals(novo.email, 'tomas@x.com');
  assertEquals(camposAlterados(cadastro, novo), ['telefone', 'receber_sms']);
});

Deno.test('e-mail vazio apaga; preço novo entra', () => {
  const novo = aplicarEdicao(cadastro, { email: '', preco: 300 });
  assertEquals(novo.email, null);
  assertEquals(novo.preco, 300);
});
