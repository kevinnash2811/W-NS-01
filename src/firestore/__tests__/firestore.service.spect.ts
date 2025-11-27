import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FirestoreService } from 'src/firestore/firestore.service';
import { InteractionRecord } from 'src/shared/interfaces/ai.interface';

// Mock de Firestore
const mockFirestore = {
  collection: jest.fn(),
};

jest.mock('@google-cloud/firestore', () => {
  return {
    Firestore: jest.fn().mockImplementation(() => mockFirestore),
  };
});

describe('FirestoreService', () => {
  let firestoreService: FirestoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirestoreService],
    }).compile();

    firestoreService = module.get<FirestoreService>(FirestoreService);

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveInteraction', () => {
    it('debería guardar interacción correctamente', async () => {
      // Arrange
      const mockCollection = {
        add: jest.fn().mockResolvedValue({}),
      };
      mockFirestore.collection.mockReturnValue(mockCollection);

      const interaction: InteractionRecord = {
        message: 'Test message',
        expectedIntent: 'tracking',
        finalResult: {
          ok: true,
          intent: 'tracking',
          attemptsUsed: 1,
        },
        attemptsHistory: [],
        timestamp: new Date(),
        processingTime: 1000,
        metadata: {
          userId: 'user-123',
          source: 'api',
        },
      };

      // Act
      await firestoreService.saveInteraction(interaction);

      // Assert
      expect(mockFirestore.collection).toHaveBeenCalledWith('interactions');
      expect(mockCollection.add).toHaveBeenCalledWith({
        ...interaction,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('getInteractionsByAttempts', () => {
    it('debería retornar interacciones filtradas por intentos', async () => {
      // Arrange
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              data: () => ({
                message: 'Test 1',
                expectedIntent: 'tracking',
                finalResult: { attemptsUsed: 2, ok: true },
                attemptsHistory: [],
                timestamp: new Date(),
                processingTime: 1000,
                metadata: {},
              }),
            },
          ],
        }),
      };

      mockFirestore.collection.mockReturnValue(mockQuery);

      // Act
      const result = await firestoreService.getInteractionsByAttempts(2, 10);

      // Assert
      expect(mockQuery.where).toHaveBeenCalledWith('finalResult.attemptsUsed', '==', 2);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });
});