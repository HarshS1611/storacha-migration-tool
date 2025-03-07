import { StorachaMigratorConfig } from "../types";
import { Logger } from "../types";

export class RetryManager {
  private readonly config: StorachaMigratorConfig["retry"];
  private readonly logger: Logger;

  constructor(config: StorachaMigratorConfig["retry"], logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error = new Error("No error details available");

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        lastError = new Error(message);
        this.logger.warn(
          `Attempt ${attempt}/${this.config.maxAttempts} failed for ${context}: ${message}`
        );

        if (attempt < this.config.maxAttempts) {
          const backoffTime = this.calculateBackoff(attempt);
          await this.delay(backoffTime);
          continue;
        }
      }
    }

    throw new Error(
      `Operation ${context} failed after ${this.config.maxAttempts} attempts: ${lastError.message}`
    );
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(
      this.config.backoffMs * Math.pow(2, attempt - 1),
      this.config.maxBackoffMs
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
