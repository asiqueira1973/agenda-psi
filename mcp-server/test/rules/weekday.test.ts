import { describe, expect, it } from 'vitest';
import { diaDaSemanaDoBanco, diasDaSemanaDe } from '../../src/rules/weekday.js';

// Pegadinha 7: 1 = segunda … 7 = domingo; não é o getDay() do JavaScript.
describe('diaDaSemanaDoBanco (regra 11.6)', () => {
  it('segunda é 1', () => expect(diaDaSemanaDoBanco('2026-11-16')).toBe(1));
  it('quinta é 4', () => expect(diaDaSemanaDoBanco('2026-11-19')).toBe(4));
  it('domingo é 7, não 0', () => expect(diaDaSemanaDoBanco('2026-11-15')).toBe(7));
  it('data inexistente é recusada', () => expect(diaDaSemanaDoBanco('2026-02-31')).toBeNull());
  it('formato errado é recusado', () => {
    expect(diaDaSemanaDoBanco('15/11/2026')).toBeNull();
    expect(diaDaSemanaDoBanco('2026-11-5')).toBeNull();
  });
});

describe('diasDaSemanaDe', () => {
  it('um domingo pertence à semana que começou na segunda anterior', () => {
    expect(diasDaSemanaDe('2026-11-15')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });
  it('atravessa a virada do mês', () => {
    expect(diasDaSemanaDe('2026-12-01')?.[0]).toBe('2026-11-30');
  });
});
