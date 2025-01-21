import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class AppBootstrapLogger implements OnApplicationBootstrap {
	private readonly logger = new Logger(AppBootstrapLogger.name);
	private readonly startTime = Date.now(); // Using Date.now() instead of performance.now()

	/**
	 * Logs the total startup time when the application finishes bootstrapping.
	 * This method calculates the duration from the recorded start time and logs the result
	 * in a human-readable format (minutes and seconds).
	 */
	onApplicationBootstrap(): void {
		const totalTimeMs = Date.now() - this.startTime; // Calculate difference in milliseconds
		const minutes = Math.floor(totalTimeMs / 60000); // Convert milliseconds to minutes
		const seconds = ((totalTimeMs % 60000) / 1000).toFixed(2); // Convert remaining milliseconds to seconds

		this.logger.log(`Application started in ${minutes}m ${seconds}s`);
	}
}
