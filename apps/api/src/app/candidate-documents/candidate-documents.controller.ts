import {
	ICandidateDocumentCreateInput,
	ICandidateDocument
} from './../../../../../libs/models/src/lib/candidate-document.model';
import {
	Controller,
	UseGuards,
	Post,
	HttpStatus,
	Body,
	HttpCode,
	Put,
	Param,
	Delete,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateDocument } from './candidate-documents.entity';
import { IPagination } from '../core';

@ApiTags('candidate_documents')
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
	//////   GET
	@ApiOperation({
		summary: 'Find all Documents'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Document',
		type: CandidateDocument
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Document not found'
	})
	@Get()
	async findDocuments(
		@Query('data') data: string
	): Promise<IPagination<CandidateDocument>> {
		const { findInput } = JSON.parse(data);
		return this.candidateDocumentsService.findAll({ where: findInput });
	}

	///////  DELETE
	@ApiOperation({ summary: 'Delete Document' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The Document has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Document not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: "This Document can't be deleted"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id') id: string): Promise<any> {
		return this.candidateDocumentsService.deleteDocument(id);
	}
}
