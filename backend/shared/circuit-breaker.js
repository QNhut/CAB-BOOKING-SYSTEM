/**
 * Circuit Breaker – shared utility for microservices
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30_000; // 30s
    this.halfOpenMax = options.halfOpenMax || 1;

    this.state = "CLOSED";
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;
  }

  async exec(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.halfOpenAttempts = 0;
      } else {
        throw new Error(`Circuit breaker [${this.name}] is OPEN`);
      }
    }

    if (this.state === "HALF_OPEN" && this.halfOpenAttempts >= this.halfOpenMax) {
      throw new Error(`Circuit breaker [${this.name}] HALF_OPEN limit reached`);
    }

    try {
      if (this.state === "HALF_OPEN") this.halfOpenAttempts++;
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
    this.halfOpenAttempts = 0;
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// Support both ESM and CommonJS
export { CircuitBreaker };
try { module.exports = { CircuitBreaker }; } catch {}
