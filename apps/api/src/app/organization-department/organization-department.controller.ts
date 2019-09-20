import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';
import { IPagination } from '../core';

@ApiUseTags('Organization-Department')
@Controller()
export class OrganizationDepartmentController extends CrudController<
	OrganizationDepartment
> {
	constructor(
		private readonly organizationDepartmentService: OrganizationDepartmentService
	) {
		super(organizationDepartmentService);
	}

	@ApiOperation({
		title: 'Find all organization departments recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found departments recurring expense',
		type: OrganizationDepartment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationDepartment>> {
		const { findInput } = JSON.parse(data);

		return this.organizationDepartmentService.findAll({ where: findInput });
	}
}
