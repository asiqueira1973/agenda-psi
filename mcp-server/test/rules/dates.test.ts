import { describe, expect, it } from 'vitest';
import { dataValida, hojeEmSaoPaulo } from '../../src/rules/dates.js';

describe('hojeEmSaoPaulo (regra 11.3)', () => {
  it('às 23h30 de Brasília (02h30 UTC do dia seguinte) ainda é o mesmo dia', () => {
    // 15/11/2026 23:30 em São Paulo (UTC-3) = 16/11/2026 02:30 UTC.
    expect(hojeEmSaoPaulo(new Date('2026-11-16T02:30:00Z'))).toBe('2026-11-15');
  });
  it('à 00h05 de Brasília já é o dia seguinte', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-16T03:05:00Z'))).toBe('2026-11-16');
  });
  it('formato AAAA-MM-DD', () => {
    expect(hojeEmSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dataValida', () => {
  it('aceita data real', () => expect(dataValida('2026-02-28')).toBe('2026-02-28'));
  it('recusa 31/02', () => expect(dataValida('2026-02-31')).toBeNull());
  it('recusa o que não é texto', () => expect(dataValida(20260228)).toBeNull());
});
