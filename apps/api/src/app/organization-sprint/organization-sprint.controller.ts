import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Sprint')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationSprintController extends CrudController<
	OrganizationSprint
> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService
	) {
		super(organizationSprintService);
	}
}
