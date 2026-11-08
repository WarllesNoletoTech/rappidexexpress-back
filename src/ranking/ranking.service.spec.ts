import { parseRankingWeek, weekStartBelem } from './ranking.service';

describe('Semana do ranking: terça até segunda, horário de Belém', () => {
  it('inicia terça-feira a 00h local', () => {
    expect(weekStartBelem(new Date('2026-11-07T23:00:00.000Z')).toISOString())
      .toBe('2026-11-03T03:00:00.000Z');
  });
  it('segunda antes de meia-noite ainda pertence à semana anterior', () => {
    expect(weekStartBelem(new Date('2026-11-10T02:59:59.000Z')).toISOString())
      .toBe('2026-11-03T03:00:00.000Z');
  });
  it('terça às 00h já inicia a semana nova', () => {
    expect(weekStartBelem(new Date('2026-11-10T03:00:00.000Z')).toISOString())
      .toBe('2026-11-10T03:00:00.000Z');
  });
  it('rejeita seleção da data de quarta-feira', () => {
    expect(() => parseRankingWeek('2026-11-11')).toThrow();
  });
});
