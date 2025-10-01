export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> => {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;
  let lastError: unknown;

  while (attempt < opts.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      const baseDelay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      const delay = opts.jitter ? baseDelay * (0.5 + Math.random() * 0.5) : baseDelay;

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Retry failed");
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on rate limits, network errors, timeouts
    if (message.includes("429") || message.includes("rate limit")) {
      return true;
    }
    if (message.includes("503") || message.includes("500")) {
      return true;
    }
    if (message.includes("timeout") || message.includes("econnreset")) {
      return true;
    }
  }
  return false;
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

