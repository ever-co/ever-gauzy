import { Controller, Get } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { HealthService } from './health.service';

@Controller('/health')
export class HealthController {
	constructor(private readonly healthService: HealthService) {}

	@Public()
	@Get()
	async getHealthStatus() {
		return this.healthService.getHealthStatus();
	}

	/**
	 * Liveness probe endpoint: reports only that the Node.js process and event
	 * loop are responsive. It MUST stay free of any dependency checks (database,
	 * storage, cache, redis) — a slow or down dependency should fail readiness
	 * (`GET /api/health`), never liveness, otherwise the kubelet kills healthy
	 * pods that are merely waiting on a dependency. The session middleware is
	 * bypassed for health routes (see bootstrap/redis-store.ts), so this response
	 * never waits on a session-store write either.
	 *
	 * @returns {{ status: string; uptime: number; timestamp: string }} - Process liveness info.
	 */
	@Public()
	@Get('/live')
	getLiveness() {
		return {
			status: 'ok',
			uptime: process.uptime(),
			timestamp: new Date().toISOString()
		};
	}
}
