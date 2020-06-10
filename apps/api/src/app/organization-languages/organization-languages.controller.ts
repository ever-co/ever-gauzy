import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationLanguagesService } from './organization-languages.service';
import { OrganizationLanguages } from './organization-languages.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Languages')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationLanguagesController extends CrudController<
	OrganizationLanguages
> {
	constructor(
		private readonly organizationLanguagesService: OrganizationLanguagesService
	) {
		super(organizationLanguagesService);
	}
}
