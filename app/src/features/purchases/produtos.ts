import { Platform } from 'react-native';

/**
 * Identificadores do produto de assinatura nas duas lojas.
 *
 * São diferentes porque as lojas exigem formatos diferentes: a Apple usa DNS
 * invertido, e o Google aceita só minúsculas, números, ponto e sublinhado.
 *
 * ⚠️ Estes identificadores precisam bater EXATAMENTE com o que for cadastrado no
 * App Store Connect e no Play Console. Errar aqui não dá erro de compilação —
 * dá uma tela de paywall vazia, porque a loja devolve lista sem nada e não
 * explica por quê.
 *
 * Plano decidido em 14/09/2026: **R$ 9,90 por mês, só mensal, sem teste
 * gratuito** (resposta da pergunta aberta 25.1).
 */
export const PRODUTO_PRO_MENSAL = Platform.select({
  ios: 'com.dablab.agendapsi.pro.mensal',
  android: 'agendapsi_pro_mensal',
  default: 'agendapsi_pro_mensal',
});

/** Preço de referência, só para quando a loja não responder a tempo. */
export const PRECO_DE_REFERENCIA = 'R$ 9,90';
