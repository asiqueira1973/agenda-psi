import { useCriarSessao } from '@/features/sessions/use-sessions';
import { useCriarPagamento } from '@/features/payments/use-payments';
import { useCriarPaciente } from '@/features/patients/use-patients';
import { useCriarAgendamento } from '@/features/schedule/use-schedule';
import { useCriarDespesa } from '@/features/expenses/use-expenses';
import { useEnviarFeedback } from '@/features/settings/use-settings';
import { textoDoFeedback, type Rascunho } from './rascunhos';

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
 * Chame só com `podeConfirmar(rascunho)` verdadeiro: as validações da tela
 * moram em `rascunhos.ts`, e este arquivo confia nelas.
 */
export function useConfirmarRascunho() {
  const criarSessao = useCriarSessao();
  const criarPagamento = useCriarPagamento();
  const criarPaciente = useCriarPaciente();
  const criarAgendamento = useCriarAgendamento();
  const criarDespesa = useCriarDespesa();
  // O feedback sai pelo mesmo hook da tela de Ajustes: grava em `feedback` e
  // avisa o administrador pela `notifica-admin`, que lê o texto pelo id.
  const enviarFeedback = useEnviarFeedback();

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

  return { confirmar };
}
