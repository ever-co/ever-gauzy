import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationClientsService } from './organization-clients.service';
import { OrganizationClients } from './organization-clients.entity';
import { IPagination } from '../core';

@ApiTags('Organization-Clients')
@Controller()
export class OrganizationClientsController extends CrudController<
	OrganizationClients
> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService
	) {
		super(organizationClientsService);
	}

	@ApiOperation({ summary: 'Find all organization clients recurring expense.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found clients recurring expense',
		type: OrganizationClients
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationClients>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationClientsService.findAll({
			where: findInput,
			relations
		});
	}
}
