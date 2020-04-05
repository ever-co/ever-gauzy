import { Controller } from '@nestjs/common';
import { CrudController } from '../core';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';

@Controller()
export class IntegrationController extends CrudController<Integration> {
	constructor(private integrationService: IntegrationService) {
		super(integrationService);
	}
}
