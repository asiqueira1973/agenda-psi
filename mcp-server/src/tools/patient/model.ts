import { emailInvalidoDoApp, mensagensEpico5DoApp, sucessoPacienteDoApp } from '../../rules/copy-app.js';
import { formatarDinheiro } from '../../rules/format.js';
import { validarValorEmReais } from '../../rules/money.js';
import { resumoDoHorario, validarHorario, type HorarioNormalizado, type LinhaDeHorario } from '../schedule/model.js';

/**
 * Modelo e validação do cadastro de paciente com horários (8.5, 13.3), puro: o formulário
 * importa as mesmas regras. Valida como a tela "Novo paciente" do app (`validarNome`,
 * `validarTelefone`, `validarEmailOpcional`, `validarValorEmReais`) e cada horário como a
 * Agenda (11.6, 11.7). Observações não existem aqui (P5).
 */

/** Horário do paciente novo, como a pessoa vê (o paciente ainda não tem id). */
export type HorarioDoPaciente = Omit<LinhaDeHorario, 'paciente_id'>;

/** O cadastro como a pessoa vê no formulário: tudo texto, SMS marcado ou não. */
export type FormularioDePaciente = {
  nome: string;
  telefone: string;
  email: string;
  preco: string;
  receber_sms: boolean;
  horarios: HorarioDoPaciente[];
};

/** O cadastro conferido, pronto para gravar. */
export type PacienteNormalizado = {
  nome_completo: string;
  telefone: string;
  email: string | null;
  preco: number;
  receber_sms: boolean;
  horarios: HorarioNormalizado[];
};

type Erro = { campo: string; mensagem: string };

/** Mesma expressão de `validarEmailOpcional` do app. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida o cadastro (P3). Telefone: só `trim`, sem normalizar (11.13, como o app).
 * E-mail opcional; vazio vira `null`. Erro de horário vai para `horarios.<i>.<campo>`.
 */
export function validarPaciente(f: Partial<FormularioDePaciente>):
  { ok: true; dados: PacienteNormalizado } | { ok: false; erros: Erro[] } {
  const erros: Erro[] = [];
  const nome = (f.nome ?? '').trim();
  const telefone = (f.telefone ?? '').trim();
  const email = (f.email ?? '').trim();
  if (!nome) erros.push({ campo: 'nome', mensagem: mensagensEpico5DoApp.nomeVazio });
  if (!telefone) erros.push({ campo: 'telefone', mensagem: mensagensEpico5DoApp.telefoneVazio });
  if (email && !EMAIL.test(email)) erros.push({ campo: 'email', mensagem: emailInvalidoDoApp });
  const preco = validarValorEmReais(f.preco ?? '');
  if (!preco.valido) erros.push({ campo: 'preco', mensagem: preco.mensagem });
  const horarios: HorarioNormalizado[] = [];
  (f.horarios ?? []).forEach((h, i) => {
    const v = validarHorario(h, `horarios.${i}.`);
    if (v.ok) horarios.push(v.dados);
    else erros.push(...v.erros);
  });
  if (erros.length || !preco.valido) return { ok: false, erros };
  return { ok: true, dados: { nome_completo: nome, telefone, email: email || null, preco: preco.valor, receber_sms: f.receber_sms !== false, horarios } };
}

/** "Laura Mendes, R$ 200; Quarta 10:00–10:50". Sem telefone nem e-mail no resumo. */
export function resumoDoPaciente(p: Pick<PacienteNormalizado, 'nome_completo' | 'preco' | 'horarios'>): string {
  const horarios = p.horarios.map((h) => resumoDoHorario('', h));
  return [`${p.nome_completo}, ${formatarDinheiro(p.preco)}`, ...horarios].join('; ');
}

/** Título de sucesso do app: "<nome> cadastrado." (15.3). */
export const tituloDoPaciente = (nome: string) => sucessoPacienteDoApp(nome);

/** Texto para o modelo depois de gravar (13.3), com o id para edições futuras. */
export function textoDoPacienteParaOModelo(resumo: string, id: string, avisos: string[] = []): string {
  return `Paciente cadastrado: ${resumo} (id ${id}).${avisos.length ? ` ${avisos.join(' ')}` : ''}`;
}
