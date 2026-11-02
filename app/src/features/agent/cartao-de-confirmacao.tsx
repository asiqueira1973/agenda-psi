import { useMemo, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  ActionRow,
  DateRow,
  FormRow,
  Icon,
  ListGroup,
  MultilineRow,
  PickerRow,
  RowSeparator,
  SegmentedControl,
  SegmentedGroupContent,
  Text,
  TimeRow,
  ToggleRow,
  ValueRow,
  type OpcaoDoSeletor,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { formatarData, formatarDinheiro, nomeDoDiaDaSemana } from '@/lib/format';
import { usePacientes } from '@/features/patients/use-patients';
import { useTiposDeDespesa } from '@/features/expenses/use-expenses';
import {
  modalidadeDaSessao,
  pagamentoDaSessao,
  tipoDoPagamento,
} from '@/features/patients/valores-do-banco';
import { copyAgente } from './copy';
import {
  podeConfirmar,
  problemasDoRascunho,
  rotuloDaCategoria,
  quantidadeDeItens,
  type EstadoDoCartao,
  type ItemDeDespesa,
  type ItemDeHorario,
  type ItemDePagamento,
  type ItemDeSessao,
  type PacienteResolvido,
  type Rascunho,
} from './rascunhos';
import { useConfirmarRascunho } from './use-confirmar';

const c = copyAgente.cartao;

/** Os sete dias no número do banco (pegadinha 7: 1 = segunda). */
const opcoesDeDia: OpcaoDoSeletor[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  id: String(d),
  rotulo: nomeDoDiaDaSemana(d),
}));

/**
 * Cartão de confirmação — a regra de toda escrita do agente
 * (docs/agente-plano.md, "Desenho").
 *
 * Mostra o que vai ser gravado, deixa corrigir cada campo e só grava no
 * Confirmar. Campo ambíguo ou faltando vem destacado em vermelho, com o motivo
 * no rodapé do grupo, e o Confirmar fica desabilitado até tudo estar válido —
 * com as mesmas regras das telas de cadastro.
 *
 * Confirmar e Cancelar são linhas de ação, não botões preenchidos: a conversa
 * pode ter vários cartões, e o handoff permite um botão preenchido por tela.
 *
 * Recebe o rascunho, o estado (aberto, confirmado, cancelado) e a função que
 * avisa a conversa quando o cartão termina — com o rascunho como foi gravado,
 * para a oferta de pagamento sair dos dados conferidos e não dos propostos.
 */
export function CartaoDeConfirmacao({
  rascunho: inicial,
  estado,
  aoTerminar,
}: {
  rascunho: Rascunho;
  estado: EstadoDoCartao;
  aoTerminar: (estado: Exclude<EstadoDoCartao, 'aberto'>, gravado: Rascunho, gravados: number) => void;
}) {
  const [rascunho, setRascunho] = useState(inicial);
  // Uma chave estável por item: remover uma linha não pode embaralhar o que
  // foi digitado nas outras.
  const [chaves, setChaves] = useState(() =>
    (inicial.tipo === 'paciente' || inicial.tipo === 'feedback' ? [inicial] : inicial.itens).map(() => Crypto.randomUUID()),
  );
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gravadosAteAqui, setGravadosAteAqui] = useState(0);
  const { confirmar } = useConfirmarRascunho();

  const problemas = problemasDoRascunho(rascunho);
  const liberado = podeConfirmar(rascunho) && !gravando;
  const total = quantidadeDeItens(rascunho);

  if (estado !== 'aberto') {
    return <CartaoEncerrado rascunho={rascunho} estado={estado} gravados={gravadosAteAqui} />;
  }

  /** Troca o item `i` do rascunho, mantendo o tipo. */
  function trocarItem<T>(i: number, novo: T) {
    setRascunho((r) => {
      if (r.tipo === 'paciente' || r.tipo === 'feedback') return r;
      const itens = [...r.itens] as T[];
      itens[i] = novo;
      return { ...r, itens } as Rascunho;
    });
  }

  function remover(i: number) {
    setRascunho((r) => {
      if (r.tipo === 'paciente' || r.tipo === 'feedback') return r;
      return { ...r, itens: r.itens.filter((_, j) => j !== i) } as Rascunho;
    });
    setChaves((k) => k.filter((_, j) => j !== i));
  }

  async function aoConfirmar() {
    if (!liberado) return;
    setGravando(true);
    setErro(null);
    const { gravados, restante } = await confirmar(rascunho);
    const acumulado = gravadosAteAqui + gravados;
    setGravadosAteAqui(acumulado);
    setGravando(false);
    if (restante === null) {
      aoTerminar('confirmado', rascunho, acumulado);
      return;
    }
    // Parte gravou: o cartão continua só com o que falta. Nunca mensagem de
    // sucesso quando a escrita falhou (regra dos quatro estados).
    setRascunho(restante);
    setChaves(
      (restante.tipo === 'paciente' || restante.tipo === 'feedback' ? [restante] : restante.itens).map(() =>
        Crypto.randomUUID()
      ),
    );
    setErro(c.falhaParcial(gravados));
  }

  const removivel = rascunho.tipo !== 'paciente' && rascunho.tipo !== 'feedback' && rascunho.itens.length > 1;

  return (
    <View style={{ gap: spacing.sm }}>
      {rascunho.tipo === 'sessoes' &&
        rascunho.itens.map((item, i) => (
          <GrupoDoItem
            key={chaves[i]}
            titulo={rascunho.itens.length > 1 ? `${c.titulo.sessoes} ${i + 1}` : c.titulo.sessoes}
            problemas={problemas[i]}
            aoRemover={removivel ? () => remover(i) : undefined}
          >
            <CamposDeSessao item={item} aoMudar={(novo) => trocarItem(i, novo)} />
          </GrupoDoItem>
        ))}

      {rascunho.tipo === 'pagamentos' &&
        rascunho.itens.map((item, i) => (
          <GrupoDoItem
            key={chaves[i]}
            titulo={rascunho.itens.length > 1 ? `${c.titulo.pagamentos} ${i + 1}` : c.titulo.pagamentos}
            problemas={problemas[i]}
            aviso={item.valor_origem === 'referencia' ? c.valorDeReferencia : undefined}
            aoRemover={removivel ? () => remover(i) : undefined}
          >
            <CamposDePagamento item={item} aoMudar={(novo) => trocarItem(i, novo)} />
          </GrupoDoItem>
        ))}

      {rascunho.tipo === 'horarios' &&
        rascunho.itens.map((item, i) => (
          <GrupoDoItem
            key={chaves[i]}
            titulo={rascunho.itens.length > 1 ? `${c.titulo.horarios} ${i + 1}` : c.titulo.horarios}
            problemas={problemas[i]}
            aoRemover={removivel ? () => remover(i) : undefined}
          >
            <SeletorDePaciente
              paciente={item.paciente}
              aoMudar={(paciente) => trocarItem(i, { ...item, paciente })}
            />
            <RowSeparator />
            <CamposDeHorario item={item} aoMudar={(h) => trocarItem(i, { ...item, ...h })} />
          </GrupoDoItem>
        ))}

      {rascunho.tipo === 'despesas' &&
        rascunho.itens.map((item, i) => (
          <GrupoDoItem
            key={chaves[i]}
            titulo={rascunho.itens.length > 1 ? `${c.titulo.despesas} ${i + 1}` : c.titulo.despesas}
            problemas={problemas[i]}
            aoRemover={removivel ? () => remover(i) : undefined}
          >
            <CamposDeDespesa item={item} aoMudar={(novo) => trocarItem(i, novo)} />
          </GrupoDoItem>
        ))}

      {rascunho.tipo === 'feedback' && (
        <ListGroup
          title={c.titulo.feedback}
          footer={problemas[0].length ? problemas[0].join(' · ') : c.avisoDoFeedback}
          footerIsError={problemas[0].length > 0}
        >
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={[
                { valor: 'problema', rotulo: rotuloDaCategoria.problema },
                { valor: 'sugestao', rotulo: rotuloDaCategoria.sugestao },
                { valor: 'elogio', rotulo: rotuloDaCategoria.elogio },
              ]}
              valor={rascunho.categoria}
              onChange={(categoria) =>
                setRascunho({ ...rascunho, categoria: categoria as 'problema' | 'sugestao' | 'elogio' })
              }
              accessibilityLabel={c.titulo.feedback}
            />
          </SegmentedGroupContent>
          <MultilineRow
            value={rascunho.mensagem}
            onChangeText={(mensagem) => setRascunho({ ...rascunho, mensagem })}
            editable={!gravando}
          />
        </ListGroup>
      )}

      {rascunho.tipo === 'paciente' && (
        <CamposDePacienteNovo
          rascunho={rascunho}
          problemas={problemas[0]}
          aoMudar={(novo) => setRascunho(novo)}
        />
      )}

      <ListGroup footer={erro ?? undefined} footerIsError={!!erro}>
        <ActionRow
          label={
            gravando ? c.registrando : rascunho.tipo === 'feedback' ? c.enviarFeedback : c.confirmar(total)
          }
          onPress={() => void aoConfirmar()}
          disabled={!liberado}
        />
        <RowSeparator />
        <ActionRow
          label={c.cancelar}
          onPress={() => aoTerminar('cancelado', rascunho, gravadosAteAqui)}
          disabled={gravando}
        />
      </ListGroup>
    </View>
  );
}

/**
 * Um item do cartão: título, os campos, e no rodapé o que falta corrigir
 * (vermelho) ou o aviso do valor sugerido (cinza).
 */
function GrupoDoItem({
  titulo,
  problemas,
  aviso,
  aoRemover,
  children,
}: {
  titulo: string;
  problemas: string[];
  aviso?: string;
  aoRemover?: () => void;
  children: React.ReactNode;
}) {
  const temProblema = problemas.length > 0;
  return (
    <ListGroup
      title={titulo}
      footer={temProblema ? problemas.join(' · ') : aviso}
      footerIsError={temProblema}
    >
      {children}
      {aoRemover ? (
        <>
          <RowSeparator />
          <ActionRow label={c.remover} onPress={aoRemover} destructive />
        </>
      ) : null}
    </ListGroup>
  );
}

/**
 * Escolha do paciente. Sempre editável: o agente pode ter achado o paciente
 * certo pelo nome errado. Ambíguo ou não encontrado começa sem escolha e em
 * vermelho; a lista é o cadastro inteiro, com busca.
 */
function SeletorDePaciente({
  paciente,
  aoMudar,
}: {
  paciente: PacienteResolvido;
  aoMudar: (p: PacienteResolvido) => void;
}) {
  const pacientes = usePacientes();
  const opcoes = useMemo<OpcaoDoSeletor[]>(
    () =>
      (pacientes.data ?? [])
        .filter((p) => p.paciente_id && p.nome_completo)
        .map((p) => ({
          id: p.paciente_id as string,
          rotulo: p.nome_completo as string,
          detalhe: p.status === 'inativo' ? 'Inativo' : undefined,
        })),
    [pacientes.data],
  );

  return (
    <PickerRow
      label={c.paciente}
      opcoes={opcoes}
      valorSelecionado={paciente.situacao === 'ok' ? paciente.id : null}
      placeholder={c.escolher}
      tituloDaFolha={c.paciente}
      comBusca
      hasError={paciente.situacao !== 'ok'}
      onSelecionar={(id) => {
        const p = (pacientes.data ?? []).find((x) => x.paciente_id === id);
        if (!p?.paciente_id || !p.nome_completo) return;
        aoMudar({
          situacao: 'ok',
          id: p.paciente_id,
          nome: p.nome_completo,
          // O preço novo vale só como sugestão de valor (P2: vem da view).
          preco_referencia: p.preco_vigente ?? null,
        });
      }}
    />
  );
}

function CamposDeSessao({ item, aoMudar }: { item: ItemDeSessao; aoMudar: (i: ItemDeSessao) => void }) {
  return (
    <>
      <SeletorDePaciente paciente={item.paciente} aoMudar={(paciente) => aoMudar({ ...item, paciente })} />
      <RowSeparator />
      <DateRow label={c.data} value={item.data} onChange={(data) => aoMudar({ ...item, data })} />
      <RowSeparator />
      <ValueRow label={c.duracao} value={c.minutos(item.duracao_minutos)} />
      <SegmentedGroupContent>
        <SegmentedControl
          opcoes={modalidadeDaSessao}
          valor={item.modalidade}
          onChange={(v) => aoMudar({ ...item, modalidade: v as ItemDeSessao['modalidade'] })}
          accessibilityLabel={c.modalidade}
        />
      </SegmentedGroupContent>
      <SegmentedGroupContent>
        <SegmentedControl
          opcoes={pagamentoDaSessao}
          valor={item.pagamento}
          onChange={(v) => aoMudar({ ...item, pagamento: v as ItemDeSessao['pagamento'] })}
          accessibilityLabel={c.pagamento}
        />
      </SegmentedGroupContent>
    </>
  );
}

/**
 * Campo de valor em reais. Guarda o texto digitado à parte do número: "280,5"
 * precisa continuar na tela para a pessoa ver o que está errado, e o rascunho
 * recebe `null` até virar um inteiro válido (regra 11.2).
 */
function CampoDeValor({
  label,
  valor,
  aoMudar,
  comErro,
  placeholder = '0',
}: {
  label: string;
  valor: number | null;
  aoMudar: (v: number | null) => void;
  comErro: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor));
  return (
    <FormRow
      label={label}
      value={texto}
      onChangeText={(t) => {
        setTexto(t);
        aoMudar(/^\d+$/.test(t.trim()) ? Number(t.trim()) : null);
      }}
      keyboardType="number-pad"
      placeholder={placeholder}
      hasError={comErro}
    />
  );
}

function CamposDePagamento({
  item,
  aoMudar,
}: {
  item: ItemDePagamento;
  aoMudar: (i: ItemDePagamento) => void;
}) {
  return (
    <>
      <SeletorDePaciente paciente={item.paciente} aoMudar={(paciente) => aoMudar({ ...item, paciente })} />
      <RowSeparator />
      <CampoDeValor
        label={c.valor}
        valor={item.valor}
        comErro={item.valor === null}
        // Mexeu no valor: deixa de ser "sugerido pelo cadastro".
        aoMudar={(valor) => aoMudar({ ...item, valor, valor_origem: 'frase' })}
      />
      <RowSeparator />
      <DateRow label={c.data} value={item.data} onChange={(data) => aoMudar({ ...item, data })} />
      <SegmentedGroupContent>
        <SegmentedControl
          opcoes={tipoDoPagamento}
          valor={item.tipo}
          onChange={(v) => aoMudar({ ...item, tipo: v as ItemDePagamento['tipo'] })}
          accessibilityLabel={c.tipo}
        />
      </SegmentedGroupContent>
    </>
  );
}

function CamposDeHorario({
  item,
  aoMudar,
}: {
  item: Omit<ItemDeHorario, 'paciente'>;
  aoMudar: (h: Omit<ItemDeHorario, 'paciente'>) => void;
}) {
  return (
    <>
      <PickerRow
        label={c.dia}
        opcoes={opcoesDeDia}
        valorSelecionado={String(item.dia_semana)}
        tituloDaFolha={c.dia}
        onSelecionar={(id) => aoMudar({ ...item, dia_semana: Number(id) })}
      />
      <RowSeparator />
      <TimeRow label={c.inicio} value={item.hora_inicio} onChange={(hora_inicio) => aoMudar({ ...item, hora_inicio })} />
      <RowSeparator />
      <TimeRow label={c.fim} value={item.hora_fim} onChange={(hora_fim) => aoMudar({ ...item, hora_fim })} />
    </>
  );
}

function CamposDeDespesa({ item, aoMudar }: { item: ItemDeDespesa; aoMudar: (i: ItemDeDespesa) => void }) {
  const tipos = useTiposDeDespesa();
  const opcoes = useMemo<OpcaoDoSeletor[]>(
    () => (tipos.data ?? []).map((t) => ({ id: t.id, rotulo: t.nome })),
    [tipos.data],
  );
  return (
    <>
      <PickerRow
        label={c.tipoDeDespesa}
        opcoes={opcoes}
        valorSelecionado={item.tipo_despesa.situacao === 'ok' ? item.tipo_despesa.id : null}
        placeholder={c.escolher}
        tituloDaFolha={c.tipoDeDespesa}
        hasError={item.tipo_despesa.situacao !== 'ok'}
        onSelecionar={(id) => {
          const t = (tipos.data ?? []).find((x) => x.id === id);
          if (t) aoMudar({ ...item, tipo_despesa: { situacao: 'ok', id: t.id, nome: t.nome } });
        }}
      />
      <RowSeparator />
      <CampoDeValor
        label={c.valor}
        valor={item.valor}
        comErro={item.valor === null}
        aoMudar={(valor) => aoMudar({ ...item, valor })}
      />
      <RowSeparator />
      <DateRow label={c.data} value={item.data} onChange={(data) => aoMudar({ ...item, data })} />
      <RowSeparator />
      <FormRow
        label={c.descricao}
        placeholder={c.opcional}
        value={item.descricao ?? ''}
        onChangeText={(t) => aoMudar({ ...item, descricao: t.trim() ? t : null })}
      />
    </>
  );
}

/**
 * Paciente novo, com os horários fixos que a mesma frase pediu — o único
 * cartão de duas seções. Por baixo são duas gravações (ver use-confirmar.ts).
 */
function CamposDePacienteNovo({
  rascunho,
  problemas,
  aoMudar,
}: {
  rascunho: Extract<Rascunho, { tipo: 'paciente' }>;
  problemas: string[];
  aoMudar: (r: Extract<Rascunho, { tipo: 'paciente' }>) => void;
}) {
  const p = rascunho.paciente;
  const mudar = (campos: Partial<typeof p>) => aoMudar({ ...rascunho, paciente: { ...p, ...campos } });

  return (
    <>
      <ListGroup
        title={c.titulo.paciente}
        footer={problemas.length ? problemas.join(' · ') : undefined}
        footerIsError={problemas.length > 0}
      >
        <FormRow label={c.nome} value={p.nome} onChangeText={(nome) => mudar({ nome })} hasError={!p.nome.trim()} />
        <RowSeparator />
        <FormRow
          label={c.telefone}
          value={p.telefone ?? ''}
          onChangeText={(t) => mudar({ telefone: t.trim() ? t : null })}
          keyboardType="phone-pad"
          // Sem placeholder, o campo vazio não parece campo: a pessoa não
          // achava onde digitar (teste de 02/11/2026).
          placeholder={c.obrigatorio}
          hasError={!p.telefone?.trim()}
        />
        <RowSeparator />
        <FormRow
          label={c.email}
          value={p.email ?? ''}
          onChangeText={(t) => mudar({ email: t.trim() ? t : null })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={c.opcional}
        />
        <RowSeparator />
        <CampoDeValor
          label={c.preco}
          valor={p.preco}
          comErro={p.preco === null}
          placeholder={c.obrigatorio}
          aoMudar={(preco) => mudar({ preco })}
        />
        <RowSeparator />
        <ToggleRow label="SMS" value={p.receber_sms} onValueChange={(receber_sms) => mudar({ receber_sms })} />
      </ListGroup>

      {rascunho.horarios.map((h, i) => (
        <ListGroup key={i} title={c.tituloDeHorarioDoPacienteNovo}>
          <CamposDeHorario
            item={h}
            aoMudar={(novo) => {
              const horarios = [...rascunho.horarios];
              horarios[i] = novo;
              aoMudar({ ...rascunho, horarios });
            }}
          />
        </ListGroup>
      ))}
    </>
  );
}

/** O cartão depois de confirmado ou cancelado: um resumo, sem campos. */
function CartaoEncerrado({
  rascunho,
  estado,
  gravados,
}: {
  rascunho: Rascunho;
  estado: Exclude<EstadoDoCartao, 'aberto'>;
  gravados: number;
}) {
  const colors = useColors();
  const linhas = resumoDoRascunho(rascunho);
  const confirmado = estado === 'confirmado';

  return (
    <ListGroup title={c.titulo[rascunho.tipo]}>
      {linhas.map((l, i) => (
        <View key={i}>
          {i > 0 ? <RowSeparator /> : null}
          <ValueRow label={l.rotulo} value={l.valor} />
        </View>
      ))}
      <RowSeparator />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: screenMargin,
          paddingVertical: spacing.md,
        }}
      >
        {confirmado ? <Icon name="check" color={colors.positive} size={17} /> : null}
        <Text variant="footnote" color={confirmado ? 'positive' : 'secondaryLabel'}>
          {confirmado ? (rascunho.tipo === 'feedback' ? c.feedbackEnviado : c.registrado(gravados)) : c.cancelado}
        </Text>
      </View>
    </ListGroup>
  );
}

/** Uma linha por registro, para o cartão encerrado. */
function resumoDoRascunho(r: Rascunho): { rotulo: string; valor: string }[] {
  const nome = (p: PacienteResolvido) => (p.situacao === 'ok' ? p.nome : p.termo);
  switch (r.tipo) {
    case 'sessoes':
      return r.itens.map((i) => ({
        rotulo: nome(i.paciente),
        valor: `${formatarData(i.data)} · ${pagamentoDaSessao.find((o) => o.valor === i.pagamento)?.rotulo ?? ''}`,
      }));
    case 'pagamentos':
      return r.itens.map((i) => ({ rotulo: nome(i.paciente), valor: `${formatarData(i.data)} · ${formatarDinheiro(i.valor)}` }));
    case 'horarios':
      return r.itens.map((i) => ({
        rotulo: nome(i.paciente),
        valor: `${nomeDoDiaDaSemana(i.dia_semana)} ${i.hora_inicio}–${i.hora_fim}`,
      }));
    case 'despesas':
      return r.itens.map((i) => ({
        rotulo: i.tipo_despesa.situacao === 'ok' ? i.tipo_despesa.nome : i.tipo_despesa.termo,
        valor: `${formatarData(i.data)} · ${formatarDinheiro(i.valor)}`,
      }));
    case 'feedback':
      return [{ rotulo: rotuloDaCategoria[r.categoria], valor: r.mensagem.length > 40 ? `${r.mensagem.slice(0, 40)}…` : r.mensagem }];
    case 'paciente':
      return [
        { rotulo: r.paciente.nome, valor: r.paciente.preco ? formatarDinheiro(r.paciente.preco) : '' },
        ...r.horarios.map((h) => ({
          rotulo: c.tituloDeHorarioDoPacienteNovo,
          valor: `${nomeDoDiaDaSemana(h.dia_semana)} ${h.hora_inicio}–${h.hora_fim}`,
        })),
      ];
  }
}
