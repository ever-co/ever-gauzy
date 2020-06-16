import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateDocument } from './candidate-documents.entity';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionsEnum } from '@gauzy/models';

@ApiTags('candidate_document')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateDocumentsController extends CrudController<
	CandidateDocument
> {
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
		@Query('data') data: string
	): Promise<IPagination<CandidateDocument>> {
		const { findInput } = JSON.parse(data);
		return this.candidateDocumentsService.findAll({ where: findInput });
	}
}
