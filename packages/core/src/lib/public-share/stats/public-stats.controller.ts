import { Controller, Get, Header, HttpStatus, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeatureFlag, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { StatsGuard } from '../../stats/stats.guard';
import { PublicTransformInterceptor } from '../public-transform.interceptor';
import { PublicStatsService } from './public-stats.service';
import { PublicStats } from './public-stats.types';

/**
 * How long a client, or a CDN in front of the API, may reuse an answer: the service's own window, plus a
 * short grace in which a stale copy may be served while the next one is fetched.
 */
export const PUBLIC_STATS_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=600';

/**
 * `GET /public/stats`: the installation's aggregate counts, for anyone.
 *
 * Gated like `GET /stats/global` on `FEATURE_OPEN_STATS` (off by default; an installation that does not
 * publish its figures answers 404), rate-limited by the global throttler like every public route plus a
 * per-address budget of its own, and answered from a one-hour cache (see `PublicStatsService`). Unlike
 * `/stats/global` it carries no amounts and no activity figures: counts of rows, and hours, only.
 */
@Public()
@UseGuards(StatsGuard)
@FeatureFlag(FeatureEnum.FEATURE_OPEN_STATS)
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/stats')
export class PublicStatsController {
	constructor(private readonly _publicStatsService: PublicStatsService) {}

	/**
	 * The counts (see {@link PublicStats}).
	 *
	 * @returns The counts, from the cache when it holds them.
	 */
	@ApiOperation({
		summary:
			'Aggregate counts of this installation: tenants, users, employees, teams, projects, screenshots and tracked hours. No per-tenant data.'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'The counts.' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'This installation does not publish its statistics (FEATURE_OPEN_STATS is off).'
	})
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Header('Cache-Control', PUBLIC_STATS_CACHE_CONTROL)
	@Get()
	async getPublicStats(): Promise<PublicStats> {
		return await this._publicStatsService.getPublicStats();
	}
}
