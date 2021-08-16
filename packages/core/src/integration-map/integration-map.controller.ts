import { Controller, UseGuards } from '@nestjs/common';
import { IntegrationMapService } from './integration-map.service';
import { TenantPermissionGuard } from './../shared/guards';

@UseGuards(TenantPermissionGuard)
@Controller()
export class IntegrationMapController {
	constructor(
		private readonly integrationMapService: IntegrationMapService
	) {}
}
