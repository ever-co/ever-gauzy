import { Controller, UseGuards } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { IntegrationMapService } from './integration-map.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationMapController {
	constructor(
		private readonly _integrationMapService: IntegrationMapService
	) { }
}
