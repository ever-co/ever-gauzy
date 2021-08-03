import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateDocument } from './candidate-documents.entity';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('CandidateDocument')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateDocumentsController extends CrudController<CandidateDocument> {
	constructor(
		private readonly candidateDocumentsService: CandidateDocumentsService
	) {
		super(candidateDocumentsService);
	}
	@ApiOperation({
		summary: 'Find all candidate document.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate document',
		type: CandidateDocument
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW)
	@Get()
	async findDocument(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<CandidateDocument>> {
		const { findInput } = data;
		return this.candidateDocumentsService.findAll({ where: findInput });
	}
}
