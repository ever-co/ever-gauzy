import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationPositionsService } from './organization-positions.service';
import { OrganizationPositions } from './organization-positions.entity';
import { IPagination } from '../core';

@ApiTags('Organization-Positions')
@Controller()
export class OrganizationPositionsController extends CrudController<
	OrganizationPositions
> {
	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService
	) {
		super(organizationPositionsService);
	}

	@ApiOperation({
		summary: 'Find all organization positions recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found positions recurring expense',
		type: OrganizationPositions
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationPositions>> {
		const { findInput } = JSON.parse(data);

		return this.organizationPositionsService.findAll({ where: findInput });
	}
}
