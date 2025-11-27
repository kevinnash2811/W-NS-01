import { PromptBuilder } from '../prompt-builder.util';
import { AttemptLog } from '../../../shared/interfaces/ai.interface';

describe('PromptBuilder', () => {
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
  });

  describe('buildPrompt', () => {
    it('debería construir prompt básico sin intentos previos', () => {
      const message = '¿Dónde está mi pedido?';
      const prompt = promptBuilder.buildPrompt(message, []);

      expect(prompt).toContain(message);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('debería incluir contexto de intentos previos', () => {
      const message = 'Mi pedido no ha llegado';
      const previousAttempts = [
        {
          attempt: 1,
          prompt: 'test-prompt',
          response: {
            intent: 'complaint',
            entities: {},
            confidence: 0.8,
            reasoning: 'Wrong classification',
            estimatedTokens: 100,
          },
          timestamp: new Date(),
          tokensUsed: 100,
        },
      ];

      const prompt = promptBuilder.buildPrompt(message, previousAttempts);
      expect(prompt).toContain('complaint');
    });
  });

  describe('buildRetryPrompt', () => {
    it('debería construir prompt de reintento', () => {
      const message = 'Mi pedido no ha llegado';
      const previousAttempts = [
        {
          attempt: 1,
          prompt: 'first-prompt',
          response: {
            intent: 'complaint',
            entities: {},
            confidence: 0.8,
            reasoning: 'First attempt',
            estimatedTokens: 100,
          },
          timestamp: new Date(),
          tokensUsed: 100,
        },
      ];
      const expectedIntent = 'tracking';

      const prompt = promptBuilder.buildRetryPrompt(message, previousAttempts, expectedIntent);
      expect(prompt).toContain(message);
      expect(prompt).toContain('tracking');
    });
  });
});