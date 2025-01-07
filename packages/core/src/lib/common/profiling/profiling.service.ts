import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { performance } from 'perf_hooks';

@Injectable()
export class ProfilingService implements OnApplicationBootstrap {
	private readonly logger = new Logger(ProfilingService.name);
	private readonly moduleStartTimes = new Map<string, number>();
	private readonly moduleDurations = new Map<string, number>();
	private readonly moduleTimings = new Map<string, number>();
	private readonly appStartTime = performance.now();

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
		this.moduleTimings[moduleName] = performance.now();
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
			const duration = performance.now() - startTime;
			console.log(`[PROFILING] ${moduleName} initialized in ${duration.toFixed(2)} ms`);
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
			this.moduleStartTimes.set(moduleName, performance.now());
		}
	}

	/**
	 * Hook to mark the end time of each module and log its duration.
	 */
	markModuleEnd(moduleName: string): void {
		if (this.moduleStartTimes.has(moduleName)) {
			const startTime = this.moduleStartTimes.get(moduleName) || 0;
			const duration = performance.now() - startTime;
			this.moduleDurations.set(moduleName, duration);

			// Log the duration with threshold logic
			const threshold = 100; // Threshold in milliseconds
			if (duration > threshold) {
				this.logger.warn(`${moduleName} took ${duration.toFixed(2)}ms (exceeds threshold)`);
			} else {
				this.logger.log(`${moduleName} initialized in ${duration.toFixed(2)}ms`);
			}
		}
	}

	/**
	 * Logs the total startup time and all module durations when the application finishes bootstrapping.
	 */
	onApplicationBootstrap(): void {
		const totalStartupTime = (performance.now() - this.appStartTime).toFixed(2);
		this.logger.log(`Total application startup time: ${totalStartupTime}ms`);

		for (const [moduleName, duration] of this.moduleDurations.entries()) {
			this.logger.log(`${moduleName} total duration: ${duration.toFixed(2)}ms`);
		}
	}
}
