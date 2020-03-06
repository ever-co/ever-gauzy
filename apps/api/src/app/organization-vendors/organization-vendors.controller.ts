import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationVendorsService } from './organization-vendors.service';
import { OrganizationVendors } from './organization-vendors.entity';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Vendors')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationVendorsController extends CrudController<
	OrganizationVendors
> {
	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService
	) {
		super(organizationVendorsService);
	}

	@ApiOperation({
		summary: 'Find all organization vendors recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found vendors recurring expense',
		type: OrganizationVendors
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationVendors>> {
		const { findInput } = JSON.parse(data);

		return this.organizationVendorsService.findAll({ where: findInput });
	}
}
