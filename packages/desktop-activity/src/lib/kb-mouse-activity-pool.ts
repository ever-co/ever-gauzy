export class KbMouseActivityPool {
	private static instance: KbMouseActivityPool;

	private processCallback: (() => Promise<void>) | null = null;
	private errorHandler: ((error: unknown) => void) | null = null;
	private isRunning: boolean;
	private pollingInterval: number = 5000;

	private constructor() {
		this.isRunning = false;
	}

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

	public setPollingInterval(interval: number): void {
		if (interval > 0) {
			this.pollingInterval = interval;
		}
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
				} else {
					console.warn("No callback set for KbMouseActivityPool.");
				}
			} catch (error) {
				if (this.errorHandler) {
					this.errorHandler(error);
				} else {
					console.error("Error in KbMouseActivityPool:", error);
				}
			} finally {
				if (this.isRunning) {
					await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
				}
			}
		}
	}

	public stop(): void {
		this.isRunning = false;
	}
}
