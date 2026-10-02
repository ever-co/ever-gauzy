import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { EverStatsService } from './ever-stats.service';

/**
 * `GET /api/ever-stats/state`: `{ "enabled": true | false }` and nothing else.
 *
 * Registered only when this API serves an Ever Teams web app (`EVER_STATS_SERVES` names `teams`):
 * the Teams server reads it before sending its own version-only report, and holds no credential, so
 * the route needs none. On any other installation it does not exist (404). It is declared in
 * `ever-connect.routes.json`.
 */
@ApiTags('Anonymous usage statistics')
@Public()
@Controller('/ever-stats')
export class EverStatsStateController {
	constructor(private readonly stats: EverStatsService) {}

	@Get('state')
	@Header('Cache-Control', 'no-store')
	async state(): Promise<{ enabled: boolean }> {
		return { enabled: await this.stats.enabled() };
	}
}
