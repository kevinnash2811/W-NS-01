import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai.service';
import { PromptBuilder } from '../../shared/utils/prompt-builder.util'; 
import { FirestoreService } from '../../firestore/firestore.service'; 

describe('AIService', () => {
  let aiService: AIService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  };

  const mockPromptBuilder = {
    buildPrompt: jest.fn(),
    buildRetryPrompt: jest.fn(),
  };

  const mockFirestoreService = {
    saveInteraction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PromptBuilder,
          useValue: mockPromptBuilder,
        },
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    aiService = module.get<AIService>(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyIntentWithRetry', () => {
    it('debería existir el método', () => {
      expect(aiService.classifyIntentWithRetry).toBeDefined();
    });
  });

  describe('evaluateIntent', () => {
    it('debería existir el método', () => {
      expect(aiService.evaluateIntent).toBeDefined();
    });
  });
});