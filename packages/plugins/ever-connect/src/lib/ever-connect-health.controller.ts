import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectEnabledGuard } from './guards/ever-connect-operator.guard';

/**
 * `GET /api/ever-connect/health`: `{connected}` only, for a signed-in user (never `@Public()`: it
 * would tell anyone whether this installation is connected). Mounted only on an API that serves an
 * Ever Teams web app (`EVER_STATS_SERVES` contains `teams`), which asks it with the person's token;
 * 404 everywhere else. Declared in `ever-connect.routes.json`.
 */
@ApiTags('Ever Platform')
@ApiBearerAuth()
@UseGuards(EverConnectEnabledGuard)
@Controller('/ever-connect')
export class EverConnectHealthController {
	constructor(private readonly store: EverConnectStore) {}

	@Get('health')
	@Header('Cache-Control', 'no-store')
	async health(): Promise<{ connected: boolean }> {
		return { connected: (await this.store.connection()).status === 'connected' };
	}
}
