/**
 * Analytics do Agenda Psi — Visão do Produto.
 *
 * Ponto único de entrada. Nenhuma tela monta requisição de evento à mão.
 */
export { track, telas } from './client';
export { eventos, type NomeDeEvento, type PropriedadesDeEvento } from './events';
