import { Controller, Get, Header, Inject, NotFoundException, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { isEverStatsEnabled } from './ever-stats-enabled';
import { EVER_STATS_ENV } from './ever-stats-scheduler.service';
import { EverStatsService } from './ever-stats.service';

/**
 * `GET /api/ever-stats/state`: `{ "enabled": true | false }` and nothing else.
 *
 * Registered only when this API serves an Ever Teams web app (`EVER_STATS_SERVES` names `teams`):
 * the Teams server reads it before sending its own version-only report, and holds no credential, so
 * the route needs none. On any other installation it does not exist (404). It is declared in
 * `ever-connect.routes.json`. With `EVER_STATS_ENABLED=false` (read again here) it answers 404.
 */
@ApiTags('Anonymous usage statistics')
@Public()
@Controller('/ever-stats')
export class EverStatsStateController {
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly stats: EverStatsService,
		@Optional() @Inject(EVER_STATS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	@Get('state')
	@Header('Cache-Control', 'no-store')
	async state(): Promise<{ enabled: boolean }> {
		if (!isEverStatsEnabled(this.env)) {
			throw new NotFoundException();
		}
		return { enabled: await this.stats.enabled() };
	}
}
