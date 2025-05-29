export class KbMouseTimer {
	private static instance: KbMouseTimer;

	private flushIntervalSeconds = 60;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private onFlushCallback: ((timeData: { timeStart: Date; timeEnd: Date }, screenShot?: boolean) => void) | null =
		null;
	private screenshotIntervalSeconds = 60;
	private lastFlushTime: Date = new Date();
	private lastScreenshotTime: Date = new Date();

	private constructor() {}

	public static getInstance(): KbMouseTimer {
		if (!KbMouseTimer.instance) {
			KbMouseTimer.instance = new KbMouseTimer();
		}
		return KbMouseTimer.instance;
	}

	public setFlushInterval(seconds: number): void {
		this.flushIntervalSeconds = seconds;
	}

	public setScreenshotInterval(seconds: number): void {
		this.screenshotIntervalSeconds = seconds;
	}

	public onFlush(callback: (timeData: { timeStart: Date; timeEnd: Date }, screenshot?: boolean) => void): void {
		this.onFlushCallback = callback;
	}

	public start(): void {
		if (this.intervalId) {
			console.warn('Timer is already running.');
			return;
		}

		this.lastFlushTime = new Date();
		this.lastScreenshotTime = new Date();
		this.intervalId = setInterval(() => this.checkFlushTime(), 1000);
	}

	public stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			if (this.onFlushCallback) {
				this.onFlushCallback(
					{
						timeStart: this.lastFlushTime,
						timeEnd: new Date()
					},
					true
				);
			}
			this.intervalId = null;
		}
	}

	private checkFlushTime(): void {
		const now = new Date();
		const elapsedSeconds = Math.floor((now.getTime() - this.lastFlushTime.getTime()) / 1000);
		const elapsedSecondsScreenshot = Math.floor((now.getTime() - this.lastScreenshotTime.getTime()) / 1000);
		if (elapsedSeconds >= this.flushIntervalSeconds) {
			if (this.onFlushCallback) {
				if (elapsedSecondsScreenshot >= this.screenshotIntervalSeconds) {
					this.onFlushCallback(
						{
							timeStart: this.lastFlushTime,
							timeEnd: now
						},
						true
					);
					this.lastFlushTime = now;
					this.lastScreenshotTime = now;
				} else {
					this.onFlushCallback({
						timeStart: this.lastFlushTime,
						timeEnd: now
					});
					this.lastFlushTime = now;
				}
			}
		}
	}
}
