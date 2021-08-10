import {
	Controller,
	Get,
	HttpStatus,
	Query,
	UseGuards,
	HttpCode,
	Delete,
	Param,
	Put,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationVendorsService } from './organization-vendors.service';
import { OrganizationVendor } from './organization-vendors.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationVendors')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationVendorsController extends CrudController<OrganizationVendor> {
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
		type: OrganizationVendor
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllOrganizations(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<OrganizationVendor>> {
		const { relations, findInput, order } = data;
		return this.organizationVendorsService.findAll({
			where: findInput,
			order,
			relations
		});
	}

	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			"This Vendor can't be deleted because it is used in expense records"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string, 
		...options: any[]
	): Promise<any> {
		return this.organizationVendorsService.deleteVendor(id);
	}
	@Put(':id')
	async updateOrganizationTeam(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: OrganizationVendor,
		...options: any[]
	): Promise<OrganizationVendor> {
		return this.organizationVendorsService.create({
			id,
			...entity
		});
	}
}
