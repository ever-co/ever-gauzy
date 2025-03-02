import { Logger } from '@nestjs/common';

export class ModuleLogger {
	private static moduleTimes: Map<string, number> = new Map();

	/**
	 * Starts the timer for a given module to measure initialization time.
	 * This method records the current timestamp when a module begins its initialization.
	 *
	 * @param {string} moduleName - The name of the module whose initialization time is being tracked.
	 */
	static start(moduleName: string): void {
		this.moduleTimes.set(moduleName, Date.now());
	}

	/**
	 * Ends the timer for a given module and logs the initialization time.
	 * This method calculates the duration between the recorded start time and the current timestamp,
	 * then logs the total time taken for the module initialization in minutes and seconds format.
	 *
	 * @param {string} moduleName - The name of the module whose initialization time is being logged.
	 */
	static end(moduleName: string): void {
		const startTime = this.moduleTimes.get(moduleName);
		if (startTime) {
			const durationMs = Date.now() - startTime;
			const minutes = Math.floor(durationMs / 60000); // Convert milliseconds to minutes
			const seconds = ((durationMs % 60000) / 1000).toFixed(2); // Convert remaining milliseconds to seconds

			Logger.log(`${moduleName} initialized in ${minutes}m ${seconds}s`, 'ModuleLogger');
		}
	}
}
