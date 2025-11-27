import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from '../ai.controller'; 
import { AIService } from '../ai.service'; 
import { FirestoreService } from '../../firestore/firestore.service'; 
import { EvaluateRequestDto, AttemptsParamsDto, AttemptsQueryDto } from '../dto';

describe('AIController', () => {
  let aiController: AIController;
  let aiService: AIService;
  let firestoreService: FirestoreService;

  const mockAIService = {
    evaluateIntent: jest.fn(),
  };

  const mockFirestoreService = {
    getInteractionsByAttempts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        {
          provide: AIService,
          useValue: mockAIService,
        },
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    aiController = module.get<AIController>(AIController);
    aiService = module.get<AIService>(AIService);
    firestoreService = module.get<FirestoreService>(FirestoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateIntent', () => {
    it('debería llamar al servicio con los parámetros correctos', async () => {
      // Arrange
      const request: EvaluateRequestDto = {
        message: 'Test message',
        expectedIntent: 'tracking',
      };

      const expectedResponse = {
        ok: true,
        intent: 'tracking',
        attemptsUsed: 1,
        entities: {},
        cost: 0.0003,
        totalTokens: 150,
      };

      mockAIService.evaluateIntent.mockResolvedValue(expectedResponse);

      // Act
      const result = await aiController.evaluateIntent(
        request,
        'test-user-agent',
        'user-123',
        'webhook',
        'session-456'
      );

      // Assert
      expect(aiService.evaluateIntent).toHaveBeenCalledWith(request, expect.objectContaining({
        userId: 'user-123',
        source: 'webhook',
        sessionId: 'session-456',
        userAgent: 'test-user-agent',
      }));
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getInteractionsByAttempts', () => {
    it('debería retornar interacciones filtradas por intentos', async () => {
      // Arrange
      const params: AttemptsParamsDto = { attempts: 2 };
      const query: AttemptsQueryDto = { limit: 25 };
      
      const mockInteractions = [
        {
          id: '1',
          message: 'Test message 1',
          expectedIntent: 'tracking',
          finalResult: { ok: true, attemptsUsed: 2 },
          attemptsHistory: [],
          timestamp: new Date(),
          processingTime: 1000,
        },
      ];

      mockFirestoreService.getInteractionsByAttempts.mockResolvedValue(mockInteractions);

      // Act
      const result = await aiController.getInteractionsByAttempts(params, query);

      // Assert
      expect(firestoreService.getInteractionsByAttempts).toHaveBeenCalledWith(2, 25);
      expect(result.attempts).toBe(2);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(25);
      expect(result.interactions).toEqual(mockInteractions);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});