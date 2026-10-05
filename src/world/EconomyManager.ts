export interface TransactionResult {
  success: boolean;
  balance: number;
  error?: string;
}

export class EconomyManager {
  private balance: number;
  private listeners: Set<(balance: number) => void> = new Set();

  constructor(initialBalance: number = 100) {
    this.balance = initialBalance;
  }

  getBalance(): number {
    return this.balance;
  }

  /**
   * Subscribe to balance changes (notifies the HUD React component).
   */
  subscribe(callback: (balance: number) => void): () => void {
    this.listeners.add(callback);
    callback(this.balance);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach((callback) => {
      callback(this.balance);
    });
  }

  /**
   * Validation logic for buying seeds, tools, or land.
   */
  canAfford(cost: number): boolean {
    return Number.isFinite(cost) && this.balance >= cost;
  }

  /**
   * Rejects amounts that aren't finite, non-negative numbers. Without this,
   * `sell(NaN)` would add NaN to the balance and corrupt every later total.
   */
  private validate(amount: number, label: string): string | null {
    if (!Number.isFinite(amount)) return `${label} must be a finite number`;
    if (amount < 0) return `${label} cannot be negative`;
    return null;
  }

  buy(cost: number): TransactionResult {
    const error = this.validate(cost, "Cost");
    if (error) {
      return { success: false, balance: this.balance, error };
    }
    if (!this.canAfford(cost)) {
      return { success: false, balance: this.balance, error: "Insufficient funds" };
    }

    this.balance -= cost;
    this.notify();
    return { success: true, balance: this.balance };
  }

  /**
   * Logic for selling harvested crops or goods.
   */
  sell(earnings: number): TransactionResult {
    const error = this.validate(earnings, "Earnings");
    if (error) {
      return { success: false, balance: this.balance, error };
    }

    this.balance += earnings;
    this.notify();
    return { success: true, balance: this.balance };
  }
}

// Export a single shared instance across the frontend
export const economy = new EconomyManager(100);