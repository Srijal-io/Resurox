export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before opening
  cooldownMs?: number;       // Time in ms to wait before probing half-open
}

export class CircuitBreaker {
  private failureCount: number = 0;
  private state: BreakerState = 'CLOSED';
  private nextAttempt: number = Date.now();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownMs = options?.cooldownMs ?? 30000; // 30s default cooldown
  }

  public getState(): BreakerState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    return currentState === 'CLOSED' || currentState === 'HALF_OPEN';
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownMs;
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
}
