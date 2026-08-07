import { Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocument, IDocumentVersion, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { RestoreDocumentVersionCommand } from '../commands/restore-document-version.command';
import { DocumentVersion } from '../entities/document-version.entity';
import { GetDocumentVersionQuery } from '../queries/get-document-version.query';
import { GetDocumentVersionsQuery } from '../queries/get-document-versions.query';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentVersionController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Paginated version history, newest first — the list projection never returns content columns.
	 */
	@ApiOperation({ summary: 'List PAGE version snapshots (newest first).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Version history retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/:id/versions')
	public async findAll(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: BaseQueryDTO<DocumentVersion>
	): Promise<IPagination<IDocumentVersion>> {
		return this.queryBus.execute(new GetDocumentVersionsQuery(id, params));
	}

	/**
	 * One full snapshot incl. `contentJson`/`contentHtml`.
	 */
	@ApiOperation({ summary: 'Get one full version snapshot.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Version snapshot retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Version not found.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id/versions/:versionId')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID
	): Promise<IDocumentVersion> {
		return this.queryBus.execute(new GetDocumentVersionQuery(id, versionId));
	}

	/**
	 * **Non-destructive** restore: first snapshots the current content as a new version, then
	 * copies the target snapshot onto the document. Locked page → 423 `DOCS_LOCKED`.
	 */
	@ApiOperation({ summary: 'Restore a version snapshot (non-destructive).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Version restored successfully.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@Post('/:id/versions/:versionId/restore')
	public async restore(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID
	): Promise<IDocument> {
		return this.commandBus.execute(new RestoreDocumentVersionCommand(id, versionId));
	}
}
