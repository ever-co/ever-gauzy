import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { ArchiveDocumentCommand } from '../commands/archive-document.command';
import { DeleteDocumentCommand } from '../commands/delete-document.command';
import { DuplicateDocumentCommand } from '../commands/duplicate-document.command';
import { MoveDocumentCommand } from '../commands/move-document.command';
import { RecoverDocumentCommand } from '../commands/recover-document.command';
import { ReorderDocumentsCommand } from '../commands/reorder-documents.command';
import { UnarchiveDocumentCommand } from '../commands/unarchive-document.command';
import { DeleteDocumentQueryDTO, DuplicateDocumentDTO, MoveDocumentDTO, ReorderDocumentsDTO } from '../dto';
import { Document } from '../entities/document.entity';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentTreeController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Rewrites `index` for the listed siblings of one parent (`null` = root siblings).
	 */
	@ApiOperation({ summary: 'Reorder sibling documents.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Siblings reordered successfully.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/reorder')
	public async reorder(@Body() input: ReorderDocumentsDTO): Promise<void> {
		return this.commandBus.execute(new ReorderDocumentsCommand(input));
	}

	/**
	 * Moves a node to a new parent (`null` = root); self or descendant targets are rejected
	 * with 409 `DOCS_TREE_CYCLE`.
	 */
	@ApiOperation({ summary: 'Move a document in the tree (cycle-guarded).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document moved successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The move would create a cycle.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/:id/move')
	public async move(@Param('id', UUIDValidationPipe) id: ID, @Body() input: MoveDocumentDTO): Promise<IDocument> {
		return this.commandBus.execute(new MoveDocumentCommand(id, input));
	}

	/**
	 * Duplicates a node (optionally its whole subtree). Returns 201 with the new root node.
	 */
	@ApiOperation({ summary: 'Duplicate a document (optionally deep).' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Document duplicated successfully.', type: Document })
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/:id/duplicate')
	public async duplicate(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: DuplicateDocumentDTO
	): Promise<IDocument> {
		return this.commandBus.execute(new DuplicateDocumentCommand(id, input));
	}

	/**
	 * Archives the node and cascades to the whole subtree. Idempotent.
	 */
	@ApiOperation({ summary: 'Archive a document subtree.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document archived successfully.', type: Document })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@Post('/:id/archive')
	public async archive(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.commandBus.execute(new ArchiveDocumentCommand(id));
	}

	/**
	 * Clears the archive flags on the subtree. Idempotent.
	 */
	@ApiOperation({ summary: 'Unarchive a document subtree.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document unarchived successfully.', type: Document })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@Post('/:id/unarchive')
	public async unarchive(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.commandBus.execute(new UnarchiveDocumentCommand(id));
	}

	/**
	 * Soft delete — **allowed only when archived** (else 409 `DOCS_DELETE_REQUIRES_ARCHIVE`).
	 * `strategy=subtree` (default) soft-deletes descendants too; `strategy=promote-children`
	 * re-parents children. Blobs are never deleted from storage by this endpoint.
	 */
	@ApiOperation({ summary: 'Soft-delete an archived document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document soft-deleted successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The document is not archived.' })
	@Permissions(PermissionsEnum.DOCS_DELETE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Delete('/:id')
	public async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: DeleteDocumentQueryDTO
	): Promise<IDocument> {
		return this.commandBus.execute(new DeleteDocumentCommand(id, query?.strategy ?? 'subtree'));
	}

	/**
	 * Restores a soft-deleted document; re-parents to root if the original parent is still
	 * deleted; the document returns in archived state.
	 */
	@ApiOperation({ summary: 'Recover a soft-deleted document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document recovered successfully.', type: Document })
	@Permissions(PermissionsEnum.DOCS_DELETE)
	@Post('/:id/recover')
	public async recover(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocument> {
		return this.commandBus.execute(new RecoverDocumentCommand(id));
	}
}
