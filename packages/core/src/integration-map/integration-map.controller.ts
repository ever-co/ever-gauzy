import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from './../core/crud';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { TenantPermissionGuard } from './../shared/guards';


@UseGuards(TenantPermissionGuard)
@Controller('integration-map')
export class IntegrationMapController extends CrudController<IntegrationMap> {
	constructor(private readonly integrationMapService: IntegrationMapService) {
		super(integrationMapService);
	}
}
