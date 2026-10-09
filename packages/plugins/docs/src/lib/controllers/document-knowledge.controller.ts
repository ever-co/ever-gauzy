import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { docsRateLimit, getDocsConfig } from '../docs.config';
import { BulkKnowledgeReindexDTO, KnowledgeSearchDTO, ReindexDocumentKnowledgeDTO } from '../dto';
import {
	DocumentKnowledgeSearchService,
	IKnowledgeSearchResult
} from '../knowledge/retrieval/retrieval.service';
import {
	DocumentKnowledgeService,
	IBulkReindexResult,
	IKnowledgeStatus
} from '../services/document-knowledge.service';

/**
 * Knowledge operations of the Documents plugin (§4.8 of the backend spec): hybrid
 * retrieval, per-document import/exclude/reindex, the bulk model-drift sweep, and the
 * deployment capability probe.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentKnowledgeController {
	constructor(
		private readonly knowledgeSearchService: DocumentKnowledgeSearchService,
		private readonly knowledgeService: DocumentKnowledgeService
	) {}

	/**
	 * Hybrid lexical + vector retrieval with RRF fusion. Zero hits is HTTP 200 with an
	 * empty, well-formed envelope — never an error (degradation ladder §10).
	 */
	@ApiOperation({ summary: 'Search the organization knowledge (hybrid lexical + vector, RRF).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Ranked chunk hits with citation locators.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	// Every query fans out to a provider query-embedding call (`08-permissions-security.md` §9).
	@Throttle(docsRateLimit(getDocsConfig().searchRateLimit))
	@HttpCode(HttpStatus.OK)
	@Post('/knowledge/search')
	public async search(@Body() input: KnowledgeSearchDTO): Promise<IKnowledgeSearchResult> {
		return this.knowledgeSearchService.search(input);
	}

	/**
	 * Bulk model-drift / full re-index sweep (§8.4 of the AI-knowledge spec).
	 */
	@ApiOperation({ summary: 'Bulk re-index the knowledge (model-drift or all).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Affected-document count (enqueued unless dryRun).' })
	@Permissions(PermissionsEnum.DOCS_AI_IMPORT)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	// One request can enqueue the whole organization's corpus (§9).
	@Throttle(docsRateLimit(getDocsConfig().adminOpsRateLimit))
	@HttpCode(HttpStatus.OK)
	@Post('/knowledge/reindex')
	public async bulkReindex(@Body() input: BulkKnowledgeReindexDTO): Promise<IBulkReindexResult> {
		return this.knowledgeService.bulkReindex(input);
	}

	/**
	 * Deployment/index capability probe: `{ vectorCapable, embeddingProviderConfigured,
	 * embeddingModel }` — no counts payload.
	 */
	@ApiOperation({ summary: 'Knowledge capability status.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Capability probe payload.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/knowledge/status')
	public async status(): Promise<IKnowledgeStatus> {
		return this.knowledgeService.getStatus();
	}

	/**
	 * Imports one document into AI knowledge (explicit choice — never a side effect).
	 */
	@ApiOperation({ summary: 'Import a document into AI knowledge.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document queued (or already in knowledge).' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Not indexable / not READY.' })
	@Permissions(PermissionsEnum.DOCS_AI_IMPORT)
	@HttpCode(HttpStatus.OK)
	@Post('/documents/:id/knowledge/import')
	public async importToKnowledge(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.knowledgeService.importToKnowledge(id);
	}

	/**
	 * Excludes one document from AI knowledge — chunks and index state are removed
	 * physically in the same transaction. Idempotent.
	 */
	@ApiOperation({ summary: 'Exclude a document from AI knowledge.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document excluded.' })
	@Permissions(PermissionsEnum.DOCS_AI_IMPORT)
	@HttpCode(HttpStatus.OK)
	@Post('/documents/:id/knowledge/exclude')
	public async excludeFromKnowledge(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.knowledgeService.excludeFromKnowledge(id);
	}

	/**
	 * Re-runs `chunk → embed → index` for one document. `force: false` (default) keeps the
	 * `contentHash` skip-if-unchanged short-circuit.
	 */
	@ApiOperation({ summary: 'Re-index one document into AI knowledge.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Re-index queued.' })
	@Permissions(PermissionsEnum.DOCS_AI_IMPORT)
	@UseValidationPipe({ whitelist: true, transform: true })
	// Re-chunk + re-embed of a whole document (§9).
	@Throttle(docsRateLimit(getDocsConfig().adminOpsRateLimit))
	@HttpCode(HttpStatus.OK)
	@Post('/documents/:id/knowledge/reindex')
	public async reindexDocument(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ReindexDocumentKnowledgeDTO
	): Promise<IDocument> {
		return this.knowledgeService.reindexDocument(id, input);
	}
}
