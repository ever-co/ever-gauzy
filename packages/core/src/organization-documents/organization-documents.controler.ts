import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationDocuments } from './organization-documents.entity';
import { OrganizationDocumentsService } from './organization-documents.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('OrganizationDocuments')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationDocumentsController extends CrudController<OrganizationDocuments> {
	constructor(
		private readonly organizationDocumentsService: OrganizationDocumentsService
	) {
		super(organizationDocumentsService);
	}

	@ApiOperation({
		summary: 'Find all organization documents.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate document',
		type: OrganizationDocuments
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findDocument(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<OrganizationDocuments>> {
		const { findInput } = data;
		return this.organizationDocumentsService.findAll({ where: findInput });
	}
}
