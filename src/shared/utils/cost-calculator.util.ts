export class CostCalculator {
  private static readonly COST_PER_1K_TOKENS = 0.002; // GPT-3.5-turbo

  static calculateCost(tokens: number): number {
    return (tokens / 1000) * this.COST_PER_1K_TOKENS;
  }

  static formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
  }

  static calculateCostFromAttempts(attempts: any[]): number {
    const totalTokens = attempts.reduce((sum, attempt) => 
      sum + (attempt.tokensUsed || 0), 0
    );
    return this.calculateCost(totalTokens);
  }
}