import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationProjectsService } from './organization-projects.service';
import { OrganizationProjects } from './organization-projects.entity';
import { IPagination } from '../core';

@ApiUseTags('Organization-Projects')
@Controller()
export class OrganizationProjectsController extends CrudController<
	OrganizationProjects
> {
	constructor(
		private readonly organizationProjectsService: OrganizationProjectsService
	) {
		super(organizationProjectsService);
	}

	@ApiOperation({
		title: 'Find all organization projects recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects recurring expense',
		type: OrganizationProjects
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationProjects>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationProjectsService.findAll({
			where: findInput,
			relations
		});
	}
}
