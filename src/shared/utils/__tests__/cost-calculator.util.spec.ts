import { CostCalculator } from '../cost-calculator.util';

describe('CostCalculator', () => {
  describe('calculateCost', () => {
    it('debería calcular costo correctamente para 1000 tokens', () => {
      const cost = CostCalculator.calculateCost(1000);
      expect(cost).toBe(0.002);
    });

    it('debería calcular costo correctamente para 500 tokens', () => {
      const cost = CostCalculator.calculateCost(500);
      expect(cost).toBe(0.001);
    });

    it('debería calcular costo 0 para 0 tokens', () => {
      const cost = CostCalculator.calculateCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('debería formatear costo con 4 decimales', () => {
      const formatted = CostCalculator.formatCost(0.002567);
      expect(formatted).toBe('$0.0026');
    });
  });

  describe('calculateCostFromAttempts', () => {
    it('debería calcular costo total desde array de intentos', () => {
      const attempts = [
        { tokensUsed: 100 },
        { tokensUsed: 200 },
        { tokensUsed: 150 },
      ];

      const cost = CostCalculator.calculateCostFromAttempts(attempts);
      // Usar toBeCloseTo para problemas de precisión numérica
      expect(cost).toBeCloseTo(0.0009, 6); // 6 decimales de precisión
    });
  });
});