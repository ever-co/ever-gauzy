import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { FeatureEnum } from '@gauzy/contracts';
import { FeatureFlag, Public } from '@gauzy/common';
import { StatsService } from './stats.service';
import { GlobalStats } from './stats.types';
import { StatsGuard } from './stats.guard';

@Controller('/stats')
@Public()
export class StatsController {
	private readonly logger = new Logger(StatsController.name);

	constructor(private readonly _statsService: StatsService) {}

	/**
	 * Fetches and returns the global statistics from the StatsService.
	 * Logs the statistics for monitoring purposes.
	 *
	 * @returns {Promise<GlobalStats>} - A promise that resolves to the global stats
	 * @throws {Error} - Throws an error if there is an issue fetching the stats
	 */
	@UseGuards(StatsGuard)
	@FeatureFlag(FeatureEnum.FEATURE_OPEN_STATS)
	@Get('/global')
	async getGlobalStats(): Promise<GlobalStats> {
		try {
			// Fetch the global statistics from the StatsService
			const stats = await this._statsService.getGlobalStats();

			// Log the global stats for debugging and monitoring (built only when debug logging is on)
			if (Logger.isLevelEnabled('debug')) {
				this.logger.debug(`Global Stats: ${JSON.stringify(stats)}`);
			}

			// Return the fetched global statistics
			return stats;
		} catch (error) {
			// Log the error and rethrow to handle it at a higher level (e.g., middleware or global exception filter)
			this.logger.error(`Error fetching global stats: ${error?.message ?? error}`, error?.stack);
			// Throw a custom error message
			throw new Error(`Failed to retrieve global statistics: ${error.message}`);
		}
	}
}
