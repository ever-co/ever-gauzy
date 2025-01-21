import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { IOrganizationDocument, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('OrganizationDocument')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-documents')
export class OrganizationDocumentController extends CrudController<OrganizationDocument> {
	constructor(private readonly organizationDocumentService: OrganizationDocumentService) {
		super(organizationDocumentService);
	}

	/**
	 * GET all organization documents
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization document.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization document',
		type: OrganizationDocument
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationDocument>> {
		const { findInput } = data;
		return this.organizationDocumentService.findAll({ where: findInput });
	}
}
