import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Put,
	Param,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { IOrganizationEmploymentType, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationEmploymentType')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationEmploymentTypeController extends CrudController<OrganizationEmploymentType> {
	constructor(
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypeService
	) {
		super(organizationEmploymentTypeService);
	}

	@ApiOperation({
		summary: 'Find all organization employment types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employment types',
		type: OrganizationEmploymentType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllOrganizationEmploymentTypes(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationEmploymentType>> {
		const { findInput, relations } = data;
		return this.organizationEmploymentTypeService.findAll({
			where: findInput,
			relations
		});
	}

	@Put(':id')
	async updateOrganizationExpenseCategories(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: OrganizationEmploymentType,
		...options: any[]
	): Promise<OrganizationEmploymentType> {
		return this.organizationEmploymentTypeService.create({
			id,
			...entity
		});
	}
}
