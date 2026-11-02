import { useCriarSessao, useEditarSessao, useExcluirSessao } from '@/features/sessions/use-sessions';
import { useCriarPagamento, useEditarPagamento, useExcluirPagamento } from '@/features/payments/use-payments';
import { useAtualizarPreco, useCriarPaciente, useEditarPaciente } from '@/features/patients/use-patients';
import { useCriarAgendamento, useExcluirAgendamento } from '@/features/schedule/use-schedule';
import { useCriarDespesa, useEditarDespesa, useExcluirDespesa } from '@/features/expenses/use-expenses';
import { useEnviarFeedback } from '@/features/settings/use-settings';
import { comMudancas, textoDoFeedback, type Rascunho } from './rascunhos';

/**
 * Grava um rascunho confirmado — o único lugar do agente que escreve no banco.
 *
 * Usa os MESMOS hooks das telas de cadastro: mesmas colunas, mesmos padrões,
 * mesma invalidação de cache e os mesmos eventos de analytics com série
 * histórica (`agenda_psi_novasessao` e os outros — pegadinha 5). Uma sessão
 * registrada pelo agente é indistinguível de uma registrada pela tela, e é
 * isso que se quer.
 *
 * Grava item a item, em ordem. Se um falhar, os anteriores ficam — cada item é
 * um registro independente, como se a pessoa tivesse salvo vários pela tela —
 * e os que faltam voltam no `restante`, para o cartão continuar com eles.
 *
 * Paciente novo com horários: o paciente primeiro, os horários depois com o id
 * dele. Se só os horários falharem, o paciente fica (paciente sem horário é um
 * estado válido do app) e o restante vira um cartão de horários dele.
 *
 * Troca de horário: o novo primeiro, o antigo sai depois — o paciente nunca
 * fica sem horário. Se só a saída do antigo falhar, o restante vira o cartão
 * de tirar o antigo da agenda.
 *
 * Edições (cadastro, sessão, pagamento, despesa): os hooks das telas de
 * detalhe recebem o id do registro na criação, então quem chama passa
 * `idDoRegistro` — o do paciente, da sessão, do pagamento ou da despesa que o
 * cartão altera. Vazio quando o cartão não é de edição: os hooks existem, mas
 * nunca são acionados.
 *
 * Chame só com `podeConfirmar(rascunho)` verdadeiro: as validações da tela
 * moram em `rascunhos.ts`, e este arquivo confia nelas.
 */
export function useConfirmarRascunho(idDoRegistro: string) {
  const criarSessao = useCriarSessao();
  const criarPagamento = useCriarPagamento();
  const criarPaciente = useCriarPaciente();
  const criarAgendamento = useCriarAgendamento();
  const criarDespesa = useCriarDespesa();
  // O feedback sai pelo mesmo hook da tela de Ajustes: grava em `feedback` e
  // avisa o administrador pela `notifica-admin`, que lê o texto pelo id.
  const enviarFeedback = useEnviarFeedback();
  const excluirAgendamento = useExcluirAgendamento();
  const editarPaciente = useEditarPaciente(idDoRegistro);
  const atualizarPreco = useAtualizarPreco(idDoRegistro);
  const editarSessao = useEditarSessao(idDoRegistro);
  const excluirSessao = useExcluirSessao();
  const editarPagamento = useEditarPagamento(idDoRegistro);
  const excluirPagamento = useExcluirPagamento();
  const editarDespesa = useEditarDespesa(idDoRegistro);
  const excluirDespesa = useExcluirDespesa();

  /**
   * Recebe o rascunho já editado e válido. Devolve quantos registros foram
   * gravados e o que sobrou para tentar de novo (null quando tudo foi).
   */
  async function confirmar(r: Rascunho): Promise<{ gravados: number; restante: Rascunho | null }> {
    let gravados = 0;

    // Grava os itens em ordem e devolve os que não foram.
    async function emOrdem<T>(itens: T[], gravar: (item: T) => Promise<unknown>): Promise<T[]> {
      for (let i = 0; i < itens.length; i++) {
        try {
          await gravar(itens[i]);
          gravados++;
        } catch {
          return itens.slice(i);
        }
      }
      return [];
    }

    // O `situacao === 'ok'` é garantido por `podeConfirmar`; a checagem fica
    // para o TypeScript e para nunca gravar sem paciente.
    const idDe = (p: { situacao: string; id?: string }) => {
      if (p.situacao !== 'ok' || !p.id) throw new Error('paciente sem escolha');
      return p.id;
    };

    switch (r.tipo) {
      case 'sessoes': {
        const faltam = await emOrdem(r.itens, (i) =>
          criarSessao.mutateAsync({
            pacienteId: idDe(i.paciente),
            ocorreuEmDia: i.data,
            modalidade: i.modalidade,
            duracaoMinutos: i.duracao_minutos,
            pagamento: i.pagamento,
            deveSerCobrada: true,
            observacoes: null,
          })
        );
        return { gravados, restante: faltam.length ? { tipo: 'sessoes', itens: faltam } : null };
      }
      case 'pagamentos': {
        const faltam = await emOrdem(r.itens, (i) =>
          criarPagamento.mutateAsync({
            pacienteId: idDe(i.paciente),
            valorPagamento: i.valor as number,
            dataCompetencia: i.data,
            tipo: i.tipo,
            observacoes: null,
          })
        );
        return { gravados, restante: faltam.length ? { tipo: 'pagamentos', itens: faltam } : null };
      }
      case 'horarios': {
        const faltam = await emOrdem(r.itens, (i) =>
          criarAgendamento.mutateAsync({
            pacienteId: idDe(i.paciente),
            diaSemana: i.dia_semana,
            horaInicio: i.hora_inicio,
            horaFim: i.hora_fim,
            observacoes: null,
          })
        );
        return { gravados, restante: faltam.length ? { tipo: 'horarios', itens: faltam } : null };
      }
      case 'despesas': {
        const faltam = await emOrdem(r.itens, (i) => {
          if (i.tipo_despesa.situacao !== 'ok') throw new Error('tipo sem escolha');
          return criarDespesa.mutateAsync({
            tipoDespesaId: i.tipo_despesa.id,
            valorDespesa: i.valor as number,
            dataCompetencia: i.data,
            descricao: i.descricao,
            observacoes: null,
          });
        });
        return { gravados, restante: faltam.length ? { tipo: 'despesas', itens: faltam } : null };
      }
      case 'troca_horario': {
        if (r.atual.situacao !== 'ok') return { gravados: 0, restante: r };
        try {
          await criarAgendamento.mutateAsync({
            pacienteId: r.paciente.id,
            diaSemana: r.novo.dia_semana,
            horaInicio: r.novo.hora_inicio,
            horaFim: r.novo.hora_fim,
            observacoes: null,
          });
        } catch {
          return { gravados: 0, restante: r };
        }
        try {
          await excluirAgendamento.mutateAsync(r.atual.id);
          return { gravados: 1, restante: null };
        } catch {
          // O novo já existe; o que falta é só tirar o antigo.
          return { gravados: 1, restante: { tipo: 'remocao_horario', paciente: r.paciente, atual: r.atual } };
        }
      }
      case 'remocao_horario': {
        if (r.atual.situacao !== 'ok') return { gravados: 0, restante: r };
        try {
          await excluirAgendamento.mutateAsync(r.atual.id);
          return { gravados: 1, restante: null };
        } catch {
          return { gravados: 0, restante: r };
        }
      }
      case 'edicao_paciente': {
        const { atual, novo } = r;
        const cadastroMudou =
          atual.nome !== novo.nome || atual.telefone !== novo.telefone || atual.email !== novo.email ||
          atual.observacoes !== novo.observacoes || atual.status !== novo.status ||
          atual.receber_sms !== novo.receber_sms;
        try {
          // O cadastro vai inteiro, observações incluídas: a edição da tela
          // grava todos os campos, e omitir um o apagaria.
          if (cadastroMudou) {
            await editarPaciente.mutateAsync({
              nomeCompleto: novo.nome,
              telefone: novo.telefone,
              email: novo.email,
              observacoes: novo.observacoes,
              status: novo.status,
              receberSms: novo.receber_sms,
            });
          }
        } catch {
          return { gravados: 0, restante: r };
        }
        // Preço é linha NOVA em precos_paciente, nunca update (regra 11.2).
        if (novo.preco !== atual.preco && novo.preco !== null) {
          try {
            await atualizarPreco.mutateAsync({ preco: novo.preco, observacoes: null });
          } catch {
            // O cadastro foi; falta o preço. O cartão continua só com ele.
            return { gravados: cadastroMudou ? 1 : 0, restante: { ...r, atual: { ...novo, preco: atual.preco } } };
          }
        }
        return { gravados: 1, restante: null };
      }
      case 'edicao_sessao':
      case 'exclusao_sessao':
      case 'edicao_pagamento':
      case 'exclusao_pagamento':
      case 'edicao_despesa':
      case 'exclusao_despesa': {
        if (r.alvo.situacao !== 'ok') return { gravados: 0, restante: r };
        try {
          await gravarRegistro(r);
          return { gravados: 1, restante: null };
        } catch {
          return { gravados: 0, restante: r };
        }
      }
      case 'feedback': {
        try {
          await enviarFeedback.mutateAsync(textoDoFeedback(r));
          return { gravados: 1, restante: null };
        } catch {
          return { gravados: 0, restante: r };
        }
      }
      case 'paciente': {
        let pacienteId: string;
        try {
          pacienteId = await criarPaciente.mutateAsync({
            nomeCompleto: r.paciente.nome,
            telefone: r.paciente.telefone ?? '',
            email: r.paciente.email,
            observacoes: null,
            preco: r.paciente.preco as number,
            receberSms: r.paciente.receber_sms,
          });
          gravados++;
        } catch {
          return { gravados, restante: r };
        }

        // Os horários saem com o id recém-criado. Falhou um: o paciente fica,
        // e o que sobrou vira cartão de horários DELE.
        const dele = {
          situacao: 'ok' as const,
          id: pacienteId,
          nome: r.paciente.nome,
          preco_referencia: r.paciente.preco,
        };
        const faltam = await emOrdem(r.horarios, (h) =>
          criarAgendamento.mutateAsync({
            pacienteId,
            diaSemana: h.dia_semana,
            horaInicio: h.hora_inicio,
            horaFim: h.hora_fim,
            observacoes: null,
          })
        );
        return {
          gravados,
          restante: faltam.length
            ? { tipo: 'horarios', itens: faltam.map((h) => ({ ...h, paciente: dele })) }
            : null,
        };
      }
    }
  }

  /**
   * Altera ou apaga um registro existente. Os campos que a tela não deixa
   * mudar (data da sessão, competência) nem estão nos parâmetros dos hooks.
   * Alteração manda o registro inteiro com as mudanças por cima: o update da
   * tela grava todos os campos, e omitir um o apagaria.
   */
  async function gravarRegistro(r: Rascunho): Promise<void> {
    switch (r.tipo) {
      case 'edicao_sessao': {
        const s = comMudancas(r.alvo, r.mudancas);
        if (!s) throw new Error('sem registro');
        await editarSessao.mutateAsync({
          pacienteId: s.paciente_id,
          modalidade: s.modalidade,
          duracaoMinutos: s.duracao_minutos,
          pagamento: s.pagamento,
          deveSerCobrada: s.cobrada,
          observacoes: s.observacoes,
        });
        return;
      }
      case 'exclusao_sessao':
        if (r.alvo.situacao !== 'ok') throw new Error('sem registro');
        await excluirSessao.mutateAsync({ sessaoId: r.alvo.registro.id, pacienteId: r.alvo.registro.paciente_id });
        return;
      case 'edicao_pagamento': {
        const g = comMudancas(r.alvo, r.mudancas);
        if (!g) throw new Error('sem registro');
        await editarPagamento.mutateAsync({
          pacienteId: g.paciente_id,
          valorPagamento: g.valor,
          tipo: g.tipo,
          observacoes: g.observacoes,
        });
        return;
      }
      case 'exclusao_pagamento':
        if (r.alvo.situacao !== 'ok') throw new Error('sem registro');
        await excluirPagamento.mutateAsync({ pagamentoId: r.alvo.registro.id, pacienteId: r.alvo.registro.paciente_id });
        return;
      case 'edicao_despesa': {
        const d = comMudancas(r.alvo, r.mudancas);
        if (!d) throw new Error('sem registro');
        await editarDespesa.mutateAsync({
          tipoDespesaId: d.tipo_despesa_id,
          valorDespesa: d.valor,
          descricao: d.descricao,
          observacoes: d.observacoes,
        });
        return;
      }
      case 'exclusao_despesa':
        if (r.alvo.situacao !== 'ok') throw new Error('sem registro');
        await excluirDespesa.mutateAsync(r.alvo.registro.id);
        return;
      default:
        throw new Error('não é registro existente');
    }
  }

  return { confirmar };
}
