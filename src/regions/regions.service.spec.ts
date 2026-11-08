import { amount, normalizedNeighborhood } from './regions.service';

describe('Tarifas de bairros', () => {
  it('normaliza acentos e pontuação para encontrar bairros', () => {
    expect(normalizedNeighborhood('Vila Lobão')).toBe(normalizedNeighborhood(' vila-lobao '));
  });
  it('aceita centavos sem erro de ponto flutuante', () => {
    expect(amount(0.29)).toBe(0.29);
    expect(amount('3,00')).toBe(3);
  });
  it('rejeita taxas negativas ou não numéricas', () => {
    expect(() => amount(-1)).toThrow();
    expect(() => amount('qualquer')).toThrow();
  });
});
