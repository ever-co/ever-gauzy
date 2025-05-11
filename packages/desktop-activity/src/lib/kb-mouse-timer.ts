export class KbMouseTimer {
	private static instance: KbMouseTimer;

	private flushIntervalSeconds: number = 60;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private onFlushCallback: ((timeData: { timeStart: Date; timeEnd: Date }) => void) | null = null;
	private lastFlushTime: Date = new Date();

	private constructor() { }

	public static getInstance(): KbMouseTimer {
		if (!KbMouseTimer.instance) {
			KbMouseTimer.instance = new KbMouseTimer();
		}
		return KbMouseTimer.instance;
	}

	public setFlushInterval(seconds: number): void {
		this.flushIntervalSeconds = seconds;
	}

	public onFlush(callback: () => void): void {
		this.onFlushCallback = callback;
	}

	public start(): void {
		if (this.intervalId) {
			console.warn("Timer is already running.");
			return;
		}

		this.lastFlushTime = new Date();
		this.intervalId = setInterval(() => this.checkFlushTime(), 1000);
	}

	public stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.onFlushCallback({
				timeStart: this.lastFlushTime,
				timeEnd: new Date()
			})
			this.intervalId = null;
		}
	}

	private checkFlushTime(): void {
		const now = new Date();
		const elapsedSeconds = Math.floor((now.getTime() - this.lastFlushTime.getTime()) / 1000);

		if (elapsedSeconds >= this.flushIntervalSeconds) {
			this.onFlushCallback({
				timeStart: this.lastFlushTime,
				timeEnd: now
			});
			this.lastFlushTime = now;
		}
	}
}

