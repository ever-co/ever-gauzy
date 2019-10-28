import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationTeamsService } from './organization-teams.service';
import { OrganizationTeams } from './organization-teams.entity';
import { IPagination } from '../core';

@ApiUseTags('Organization-Teams')
@Controller()
export class OrganizationTeamsController extends CrudController<
	OrganizationTeams
> {
	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService
	) {
		super(organizationTeamsService);
	}

	@ApiOperation({
		title: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeams
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationTeams>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationTeamsService.findAll({
			where: findInput,
			relations
		});
	}
}
