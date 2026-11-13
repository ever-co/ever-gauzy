import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocument, IDocumentFollowState, IDocumentSpace, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { DocumentScopeQueryDTO } from '../dto/document-scope-query.dto';
import { MoveDocumentSpaceDTO } from '../dto/document-space.dto';
import { DocumentCollaborationService } from '../services/document-collaboration.service';
import { DocumentService } from '../services/document.service';

/**
 * The collaboration routes of Docs: the spaces of the tree, moving a page between them, and following or muting a
 * page. Every route answers 404 `DOCS_COLLAB_DISABLED` while `GAUZY_DOCS_COLLAB_ENABLED` is off.
 *
 * Registered before `DocumentController`, so the static `/documents/spaces` is never swallowed by `/documents/:id`.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentCollaborationController {
	constructor(private readonly collaboration: DocumentCollaborationService, private readonly documentService: DocumentService) {}

	@ApiOperation({ summary: 'The spaces of the Docs tree the caller sees, with their document counts.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The organization space, the private space and the team spaces.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/documents/spaces')
	public async listSpaces(@Query() query: DocumentScopeQueryDTO): Promise<IDocumentSpace[]> {
		this.collaboration.assertEnabled();
		return this.collaboration.listSpaces(this.documentService.resolveOrganizationId(query));
	}

	@ApiOperation({ summary: 'Move a page (and the descendants the caller may write) to another space.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The page as moved.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only the owner (or DOCS_MANAGE) moves a page between spaces.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/documents/:id/space')
	public async moveToSpace(@Param('id', UUIDValidationPipe) id: ID, @Body() input: MoveDocumentSpaceDTO): Promise<IDocument> {
		return this.collaboration.moveToSpace(id, input);
	}

	@ApiOperation({ summary: 'Whether the caller follows the page, and whether they muted it.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The follow state.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/documents/:id/follow')
	public async followState(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentFollowState> {
		// The page is read in the selected organization (the query scope), as `GET /documents/:id` reads it.
		return this.collaboration.followState(id, query?.organizationId);
	}

	@ApiOperation({ summary: 'Follow the page: comments and changes on it reach the Inbox.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/documents/:id/follow')
	public async follow(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentFollowState> {
		// The page is read in the selected organization (the query scope), as `GET /documents/:id` reads it.
		return this.collaboration.follow(id, query?.organizationId);
	}

	@ApiOperation({ summary: 'Stop following the page.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/documents/:id/unfollow')
	public async unfollow(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentFollowState> {
		// The page is read in the selected organization (the query scope), as `GET /documents/:id` reads it.
		return this.collaboration.unfollow(id, query?.organizationId);
	}

	@ApiOperation({ summary: 'Mute the page: nothing about it reaches the Inbox until unmuted.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/documents/:id/mute')
	public async mute(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentFollowState> {
		// The page is read in the selected organization (the query scope), as `GET /documents/:id` reads it.
		return this.collaboration.mute(id, query?.organizationId);
	}

	@ApiOperation({ summary: 'Unmute the page.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/documents/:id/unmute')
	public async unmute(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentFollowState> {
		// The page is read in the selected organization (the query scope), as `GET /documents/:id` reads it.
		return this.collaboration.unmute(id, query?.organizationId);
	}
}
