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
}
