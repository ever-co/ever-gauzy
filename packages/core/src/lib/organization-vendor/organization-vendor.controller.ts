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
	Body,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IOrganizationVendor, IPagination } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { OrganizationVendorService } from './organization-vendor.service';
import { OrganizationVendor } from './organization-vendor.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationVendor')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationVendorController extends CrudController<OrganizationVendor> {
	constructor(private readonly organizationVendorService: OrganizationVendorService) {
		super(organizationVendorService);
	}

	/**
	 * GET all organization vendors recurring expense
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization vendors recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization vendors recurring expense',
		type: OrganizationVendor
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationVendor>> {
		const { relations, findInput, order } = data;
		return this.organizationVendorService.findAll({
			where: findInput,
			order,
			relations
		});
	}

	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: PaginationParams<OrganizationVendor>): Promise<IPagination<IOrganizationVendor>> {
		return this.organizationVendorService.pagination(filter);
	}

	/**
	 * UPDATE organization vendor by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: OrganizationVendor
	): Promise<IOrganizationVendor> {
		return this.organizationVendorService.create({
			id,
			...body
		});
	}

	/**
	 * DELETE organization vendor by id
	 *
	 * @param id
	 * @returns
	 */
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
		description: "This Vendor can't be deleted because it is used in expense records"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.organizationVendorService.deleteVendor(id);
	}
}
