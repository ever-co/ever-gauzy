import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from './../shared/guards';


@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('integration-map')
export class IntegrationMapController extends CrudController<IntegrationMap> {
	constructor(private readonly integrationMapService: IntegrationMapService) {
		super(integrationMapService);
	}
}
