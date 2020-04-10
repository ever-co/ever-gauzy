import { Controller } from '@nestjs/common';
import { CrudController } from '../core';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';

@Controller()
export class IntegrationMapController extends CrudController<IntegrationMap> {
	constructor(private integrationMapService: IntegrationMapService) {
		super(integrationMapService);
	}
}
