import { Public } from '@gauzy/common';
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import * as path from 'path';

@Controller('health')
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly db: TypeOrmHealthIndicator,
		private readonly disk: DiskHealthIndicator
	) {}

	@Public()
	@Get()
	check() {
		return this.health.check([
			() => this.disk.checkStorage('storage', { path: path.resolve(__dirname), thresholdPercent: 99.999999 }), // basically will fail if disk is full
			async () => this.db.pingCheck('database', { timeout: 300 })
		]);
	}
}
