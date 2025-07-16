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
	private afkCountdown: number;
	private isAfk = false;
	private onAfkCallback: ((afk?: boolean) => void) | null = null;
	private isStarted:boolean = false;
	private timerStartedCallback: (status: 'Working' | 'Error') => void;
	private activeWindowCallback: () => void;

	private constructor() {
		this.afkCountdown = this.afkThreshold;
		this.activeWindowCallback = () => {};
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

	public setActiveWindowCallback(callback: () => void) {
		this.activeWindowCallback = callback;
	}

	public setScreenshotInterval(seconds: number): void {
		this.screenshotIntervalSeconds = seconds;
	}

	public onFlush(callback: (timeData: { timeStart: Date; timeEnd: Date }, screenshot?: boolean, afkDuration?: number) => void): void {
		this.onFlushCallback = callback;
	}

	public afkEvent(callback: (afk?: boolean) => void): void {
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
		if (this.afkCountdown > 0) {
			this.afkCountdown -= 1;
		}
		if (this.afkCountdown <= 0 && !this.isAfk) {
			this.isAfk = true;
			if (this.onAfkCallback) {
				this.onAfkCallback(this.isAfk);
			}
		}
	}

	public resetAfkTimer(): void {
		if (this.afkCountdown < this.afkThreshold) {
			this.afkCountdown = this.afkThreshold;
		}
		if(this.isAfk) {
			this.isAfk = false;
			if (this.onAfkCallback) {
				this.onAfkCallback(this.isAfk);
			}
		}
	}

	private afkCounter() {
		if (this.isAfk) {
			this.afkDuration += 1;
		}
	}

	private tickHandler(): void {
		this.activeWindowCallback();
		this.checkFlushTime();
		this.afkHandler();
		this.afkCounter();
	}

	private resetAfkCount() {
		this.afkDuration = 0;
	}

	private checkFlushTime(): void {
		try {
			if (!this.isStarted) {
				this.isStarted = true;
				if (this.timerStartedCallback) {
					this.timerStartedCallback('Working');
				}
			}
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
		} catch (error) {
			if (this.timerStartedCallback) {
				this.timerStartedCallback('Error');
			}
			console.error('checkFlushTime error:', error);
		}
	}

	public setTimerStartedCallback(callback: (status: 'Working' | 'Error') => void) {
		this.timerStartedCallback = callback;
	}
}
