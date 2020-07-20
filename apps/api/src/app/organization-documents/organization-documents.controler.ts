import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { OrganizationDocuments } from './organization-documents.entity';
import { OrganizationDocumentsService } from './organization-documents.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('organization-documents')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationDocumentsController extends CrudController<
	OrganizationDocuments
> {
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
		@Query('data') data
	): Promise<IPagination<OrganizationDocuments>> {
		const { findInput } = JSON.parse(data);
		return this.organizationDocumentsService.findAll({ where: findInput });
	}
}
