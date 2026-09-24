import { getServerConfig } from '../config';

/**
 * Concurrency Semaphore (SEC-29, PRD §6).
 * 
 * Limits simultaneous in-flight analysis jobs per server instance
 * to prevent CPU/memory starvation and unbounded queuing.
 */

class ConcurrencySemaphore {
  private activeCount: number = 0;

  acquire(maxConcurrent: number): boolean {
    if (this.activeCount >= maxConcurrent) {
      return false;
    }
    this.activeCount += 1;
    return true;
  }

  release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  reset(): void {
    this.activeCount = 0;
  }
}

export const instanceSemaphore = new ConcurrencySemaphore();

export function tryAcquireConcurrencySlot(): { acquired: boolean; maxConcurrent: number } {
  const config = getServerConfig();
  const max = config.MAX_CONCURRENT_ANALYSES;
  const acquired = instanceSemaphore.acquire(max);
  return { acquired, maxConcurrent: max };
}

export function releaseConcurrencySlot(): void {
  instanceSemaphore.release();
}
