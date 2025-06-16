export class KbMouseTimer {
	private static instance: KbMouseTimer;

	private flushIntervalSeconds = 60;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private onFlushCallback: ((timeData: { timeStart: Date; timeEnd: Date }, screenShot?: boolean, afkDuration?: number) => void) | null =
		null;
	private screenshotIntervalSeconds = 60;
	private lastFlushTime: Date = new Date();
	private lastScreenshotTime: Date = new Date();
	private afkThreshold = 30;  // in seconds
	private afkDuration = 0;
	private elapsedSecondsAfk: number;
	private isAfk = false;
	private onAfkCallback: (() => void) | null = null;

	private constructor() {
		this.elapsedSecondsAfk = this.afkThreshold;
	}

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

	public onFlush(callback: (timeData: { timeStart: Date; timeEnd: Date }, screenshot?: boolean, afkDuration?: number) => void): void {
		this.onFlushCallback = callback;
	}

	public afkEvent(callback: () => void): void {
		this.onAfkCallback = callback;
	}

	public start(): void {
		if (this.intervalId) {
			console.warn('Timer is already running.');
			return;
		}

		this.lastFlushTime = new Date();
		this.lastScreenshotTime = new Date();
		this.intervalId = setInterval(() => this.tickHandler(), 1000);
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

	private afkHandler(): void {
		if (this.elapsedSecondsAfk > 0) {
			this.elapsedSecondsAfk -= 1;
		}
		if (this.elapsedSecondsAfk <= 0 && !this.isAfk) {
			this.isAfk = true;
			if (this.onAfkCallback) {
				this.onAfkCallback();
			}
		}
	}

	public setAfkState(): void {
		this.elapsedSecondsAfk = this.afkThreshold;
		this.isAfk = false;
	}

	private afkCounter() {
		if (this.isAfk) {
			this.afkDuration += 1;
		}
	}

	private tickHandler(): void {
		this.checkFlushTime();
		this.afkHandler();
		this.afkCounter();
	}

	private resetAfkCount() {
		this.afkDuration = 0;
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
						true,
						this.afkDuration
					);
					this.lastFlushTime = now;
					this.lastScreenshotTime = now;
					this.resetAfkCount();
				} else {
					this.onFlushCallback(
						{
							timeStart: this.lastFlushTime,
							timeEnd: now
						},
						false,
						this.afkDuration
					);
					this.resetAfkCount();
					this.lastFlushTime = now;
				}
			}
		}
	}
}
