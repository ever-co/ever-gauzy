export class KbMouseActivityPool {
  private static instance: KbMouseActivityPool;

  private processCallback: (() => Promise<void>) | null = null;
  private errorHandler: ((error: unknown) => void) | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): KbMouseActivityPool {
    if (!KbMouseActivityPool.instance) {
      KbMouseActivityPool.instance = new KbMouseActivityPool();
    }
    return KbMouseActivityPool.instance;
  }

  public setCallback(callback: () => Promise<void>): void {
    this.processCallback = callback;
  }

  public setErrorCallback(callback: (error: unknown) => void): void {
    this.errorHandler = callback;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Pool is already running.");
      return;
    }

    this.isRunning = true;

    while (this.isRunning) {
      try {
        if (this.processCallback) {
          await this.processCallback();
		  await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          console.warn("No callback set for KbMouseActivityPool.");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.errorHandler(error);
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
  }
}
