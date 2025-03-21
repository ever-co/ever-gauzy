import { Injectable, Scope, Logger } from '@nestjs/common';

@Injectable({ scope: Scope.DEFAULT })
export class TimeMetric {
	private static instance: TimeMetric;
	private readonly logger: Logger;
	private readonly timers: Map<string, [number, number]>;

	constructor() {
		this.logger = new Logger('TimeMetric');
		this.timers = new Map();
		this.logger.verbose('TimeMetric initialized');
		TimeMetric.instance = this;
	}

	/**
	 * Get the shared instance of the TimeMetric class.
	 * @returns The shared instance of the TimeMetric class.
	 */
	static get shared(): TimeMetric {
		if (!TimeMetric.instance) {
			TimeMetric.instance = new TimeMetric();
		}
		return TimeMetric.instance;
	}

	public start(name: string): void {
		const startTime = process.hrtime();
		this.timers.set(name, startTime);
	}

	public measure(name: string): string {
		const startTime = this.timers.get(name);
		if (!startTime) {
			this.logger.error(`Timer ${name} not found`);
			return;
		}
		const [seconds, nanoseconds] = process.hrtime(startTime);
		const milliseconds = seconds * 1000 + nanoseconds / 1_000_000;
		return milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(2)}s` : `${milliseconds.toFixed(2)}ms`;
	}

	public end(name: string): string {
		const duration = this.measure(name);
		this.timers.delete(name);
		return duration;
	}
}
