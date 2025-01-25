import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class ProfilingService implements OnApplicationBootstrap {
	private readonly logger = new Logger(ProfilingService.name);
	private readonly moduleStartTimes = new Map<string, number>();
	private readonly moduleDurations = new Map<string, number>();
	private readonly moduleTimings = new Map<string, number>();
	private readonly appStartTime = Date.now(); // Using Date.now() instead of performance.now()

	constructor(readonly moduleRef: ModuleRef) {}

	/**
	 * Records the start time of a module's initialization process.
	 *
	 * @param moduleName - The name of the module being profiled.
	 *
	 * @description
	 * This method logs the current timestamp for the provided module name.
	 * It is intended to be called at the start of the module initialization process.
	 */
	startProfiling(moduleName: string): void {
		this.moduleTimings[moduleName] = Date.now();
	}

	/**
	 * Logs the time taken to initialize a module.
	 *
	 * @param moduleName - The name of the module being profiled.
	 *
	 * @description
	 * This method calculates and logs the duration of the module's initialization process.
	 * It is intended to be called at the end of the module initialization process.
	 * If no start time is found for the module, a warning is logged instead.
	 */
	endProfiling(moduleName: string) {
		const startTime = this.moduleTimings[moduleName];
		if (startTime) {
			const durationMs = Date.now() - startTime;
			const { minutes, seconds } = this.convertMsToMinutesAndSeconds(durationMs);
			console.log(`[PROFILING] ${moduleName} initialized in ${minutes}m ${seconds}s`);
			delete this.moduleTimings[moduleName];
		} else {
			console.warn(`[PROFILING] No start time found for module: ${moduleName}`);
		}
	}

	/**
	 * Hook to mark the start time of each module.
	 */
	markModuleStart(moduleName: string): void {
		if (!this.moduleStartTimes.has(moduleName)) {
			this.moduleStartTimes.set(moduleName, Date.now());
		}
	}

	/**
	 * Hook to mark the end time of each module and log its duration.
	 */
	markModuleEnd(moduleName: string): void {
		if (this.moduleStartTimes.has(moduleName)) {
			const startTime = this.moduleStartTimes.get(moduleName) || 0;
			const durationMs = Date.now() - startTime;
			this.moduleDurations.set(moduleName, durationMs);

			const { minutes, seconds } = this.convertMsToMinutesAndSeconds(durationMs);

			// Log the duration with threshold logic
			const thresholdMs = 100; // Threshold in milliseconds
			if (durationMs > thresholdMs) {
				this.logger.warn(`${moduleName} took ${minutes}m ${seconds}s (exceeds threshold)`);
			} else {
				this.logger.log(`${moduleName} initialized in ${minutes}m ${seconds}s`);
			}
		}
	}

	/**
	 * Logs the total startup time and all module durations when the application finishes bootstrapping.
	 */
	onApplicationBootstrap(): void {
		const totalStartupTimeMs = Date.now() - this.appStartTime;
		const { minutes, seconds } = this.convertMsToMinutesAndSeconds(totalStartupTimeMs);

		this.logger.log(`Total application startup time: ${minutes}m ${seconds}s`);

		for (const [moduleName, durationMs] of this.moduleDurations.entries()) {
			const { minutes, seconds } = this.convertMsToMinutesAndSeconds(durationMs);
			this.logger.log(`${moduleName} total duration: ${minutes}m ${seconds}s`);
		}
	}

	/**
	 * Converts milliseconds to minutes and seconds.
	 *
	 * @param ms - The duration in milliseconds.
	 * @returns {minutes, seconds} - The duration converted to minutes and seconds.
	 */
	private convertMsToMinutesAndSeconds(ms: number): { minutes: number; seconds: string } {
		const minutes = Math.floor(ms / 60000);
		const seconds = ((ms % 60000) / 1000).toFixed(2);
		return { minutes, seconds };
	}
}
