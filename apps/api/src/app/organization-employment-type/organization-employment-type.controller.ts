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
import { CrudController, IPagination } from '../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Employment-Type')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationEmploymentTypeController extends CrudController<
	OrganizationEmploymentType
> {
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
		@Query('data') data: string
	): Promise<IPagination<OrganizationEmploymentType>> {
		const { findInput, relations } = JSON.parse(data);
		return this.organizationEmploymentTypeService.findAll({
			where: findInput,
			relations
		});
	}

	@Put(':id')
	async updateOrganizationExpenseCategories(
		@Param('id') id: string,
		@Body() entity: OrganizationEmploymentType,
		...options: any[]
	): Promise<OrganizationEmploymentType> {
		return this.organizationEmploymentTypeService.create({
			id,
			...entity
		});
	}
}
