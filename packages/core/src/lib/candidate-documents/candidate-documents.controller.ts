import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateDocument, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateDocument } from './candidate-documents.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UseValidationPipe } from '../shared/pipes';

@ApiTags('CandidateDocument')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller('/candidate-documents')
export class CandidateDocumentsController extends CrudController<CandidateDocument> {
	constructor(private readonly candidateDocumentsService: CandidateDocumentsService) {
		super(candidateDocumentsService);
	}

	/**
	 * GET all candidate documents
	 *
	 * @param params
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<CandidateDocument>): Promise<IPagination<ICandidateDocument>> {
		return await this.candidateDocumentsService.findAll({
			where: params.where
		});
	}
}
