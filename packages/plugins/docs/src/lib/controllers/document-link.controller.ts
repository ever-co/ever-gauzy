import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentLink, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { CreateDocumentLinkCommand } from '../commands/create-document-link.command';
import { DeleteDocumentLinkCommand } from '../commands/delete-document-link.command';
import { CreateDocumentLinkDTO, DocumentScopeQueryDTO, GetDocumentLinksQueryDTO } from '../dto';
import { DocumentLink } from '../entities/document-link.entity';
import { GetDocumentLinksQuery } from '../queries/get-document-links.query';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentLinkController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * The "Documents panel" query for business records — every link attached to
	 * (`entity`, `entityId`), with embedded document list projections.
	 */
	@ApiOperation({ summary: 'List links attached to one business record.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Links retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/links')
	public async findForEntity(@Query() query: GetDocumentLinksQueryDTO): Promise<IPagination<IDocumentLink>> {
		return this.queryBus.execute(
			new GetDocumentLinksQuery({
				entity: query.entity,
				entityId: query.entityId,
				organizationId: query.organizationId
			})
		);
	}

	/**
	 * Idempotent link write on `(documentId, entity, entityId)` — a duplicate returns the
	 * existing row with 200.
	 */
	@ApiOperation({ summary: 'Attach a document to a business record.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Link created (or already existed).', type: DocumentLink })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/links')
	public async create(@Body() input: CreateDocumentLinkDTO): Promise<IDocumentLink> {
		return this.commandBus.execute(new CreateDocumentLinkCommand(input));
	}

	/**
	 * Removes a link.
	 */
	@ApiOperation({ summary: 'Detach a document link.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Link deleted successfully.', type: DocumentLink })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Link not found.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@Delete('/links/:id')
	public async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocumentLink> {
		return this.commandBus.execute(new DeleteDocumentLinkCommand(id));
	}

	/**
	 * The reverse direction: everything one document is attached to.
	 *
	 * `organizationId` is the client's selected organization — the document read behind this
	 * route otherwise falls back to the token's org, which is null for non-employee users (400)
	 * and stale when the client browses another organization of the tenant (404).
	 */
	@ApiOperation({ summary: 'List everything one document is linked to.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Links retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/documents/:id/links')
	public async findForDocument(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query?: DocumentScopeQueryDTO
	): Promise<IPagination<IDocumentLink>> {
		return this.queryBus.execute(
			new GetDocumentLinksQuery({ documentId: id, organizationId: query?.organizationId })
		);
	}
}
