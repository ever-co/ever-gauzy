import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocument, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { UpdateExtractedTextCommand } from '../commands/update-extracted-text.command';
import { ApproveReviewDTO, RejectReviewDTO, RequestReviewDTO, UpdateExtractedTextDTO } from '../dto';
import { DocumentKnowledgeService } from '../services/document-knowledge.service';
import { DocumentReviewService } from '../services/document-review.service';
import { DocumentService } from '../services/document.service';

/**
 * Review-workflow surface of the Documents plugin (§4.9 of the backend spec): the manual
 * review request, the approve/reject decisions (the human side of the AI review circuit
 * breaker), the extracted-text read/correction endpoints, and AI summary regeneration.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentReviewController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly documentService: DocumentService,
		private readonly documentReviewService: DocumentReviewService,
		private readonly documentKnowledgeService: DocumentKnowledgeService
	) {}

	/**
	 * Manual review request: `reviewStatus → PENDING`, `reviewReason: 'manual'`
	 * (machine-set reasons come from the pipeline). Already PENDING → 200 no-op.
	 */
	@ApiOperation({ summary: 'Request a human review of a document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document is pending review.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@HttpCode(HttpStatus.OK)
	@Post('/:id/review/request')
	public async requestReview(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: RequestReviewDTO
	): Promise<IDocument> {
		return this.documentReviewService.requestReview(id, input);
	}

	/**
	 * Approves a PENDING review — an already-INDEXED document becomes retrievable
	 * immediately (the circuit breaker opens; no re-index needed).
	 */
	@ApiOperation({ summary: 'Approve a pending document review.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Review approved.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The document is not pending review.' })
	@Permissions(PermissionsEnum.DOCS_REVIEW)
	@UseValidationPipe({ whitelist: true, transform: true })
	@HttpCode(HttpStatus.OK)
	@Post('/:id/review/approve')
	public async approveReview(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ApproveReviewDTO
	): Promise<IDocument> {
		return this.documentReviewService.approve(id, input);
	}

	/**
	 * Rejects a PENDING review — the document stays stored but is excluded from AI
	 * retrieval (`knowledgeStatus` forced to `EXCLUDED`).
	 */
	@ApiOperation({ summary: 'Reject a pending document review.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Review rejected.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The document is not pending review.' })
	@Permissions(PermissionsEnum.DOCS_REVIEW)
	@UseValidationPipe({ whitelist: true, transform: true })
	@HttpCode(HttpStatus.OK)
	@Post('/:id/review/reject')
	public async rejectReview(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: RejectReviewDTO
	): Promise<IDocument> {
		return this.documentReviewService.reject(id, input);
	}

	/**
	 * Re-runs the classification stage to regenerate the AI summary of a FILE document.
	 */
	@ApiOperation({ summary: 'Regenerate the AI summary of a document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Summary regeneration queued.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@HttpCode(HttpStatus.OK)
	@Post('/:id/summary/regenerate')
	public async regenerateSummary(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.documentKnowledgeService.regenerateSummary(id);
	}

	/**
	 * The one endpoint that returns the full extracted markdown (review/correction UI).
	 */
	@ApiOperation({ summary: 'Read the extracted text of a FILE document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Extracted text payload.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id/extracted-text')
	public async getExtractedText(@Param('id', UUIDValidationPipe) id: ID): Promise<{
		extractedText: string | null;
		extractedTextEdited: boolean;
		status: string;
		statusMessage: string | null;
	}> {
		const document = await this.documentService.findOneScoped(id);
		return {
			extractedText: document.extractedText ?? null,
			extractedTextEdited: document.extractedTextEdited,
			status: document.status,
			statusMessage: document.statusMessage ?? null
		};
	}

	/**
	 * Human correction of the extraction: stores the markdown, sets
	 * `extractedTextEdited: true` (permanently protects it from pipeline overwrite),
	 * forces `status: READY`, and re-enqueues from `docs.chunk` when the document is in
	 * knowledge. FILE kind only (409 `DOCS_NOT_A_FILE`).
	 */
	@ApiOperation({ summary: 'Save a human-corrected extraction for a FILE document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Extracted text saved.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Not a FILE document.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/:id/extracted-text')
	public async updateExtractedText(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateExtractedTextDTO
	): Promise<IDocument> {
		return this.commandBus.execute(new UpdateExtractedTextCommand(id, input));
	}
}
