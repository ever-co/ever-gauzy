import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationAwardsService } from './organization-awards.service';
import { OrganizationAwards } from './organization-awards.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Awards')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationAwardsController extends CrudController<
	OrganizationAwards
> {
	constructor(
		private readonly organizationAwardsService: OrganizationAwardsService
	) {
		super(organizationAwardsService);
	}
}
