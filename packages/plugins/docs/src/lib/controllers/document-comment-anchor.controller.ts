import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentCommentAnchorList, IDocumentCommentAnchorResolved, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { DocumentScopeQueryDTO } from '../dto/document-scope-query.dto';
import { SetDocumentCommentAnchorDTO } from '../dto/document-comment-anchor.dto';
import { DocumentCommentAnchorService } from '../services/document-comment-anchor.service';

/**
 * The text-range anchors of a page's comments. The comments themselves are the platform's (`/comment`, entity
 * `Document`); a comment's author sets its range right after posting it, and every reader gets the ranges found
 * again in the page as it is now. Access is the page's (404 when the caller may not read it); setting or removing a
 * range takes a page that takes the caller's comments. Part of Docs collaboration: every route answers 404
 * `DOCS_COLLAB_DISABLED` while `GAUZY_DOCS_COLLAB_ENABLED` is off.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentCommentAnchorController {
	constructor(private readonly anchors: DocumentCommentAnchorService) {}

	@ApiOperation({ summary: "The anchors of the page's comments, each found again in the page as it is now." })
	@ApiResponse({ status: HttpStatus.OK, description: 'The anchors, with where each is now (exact, moved, on its block, or orphaned).' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such page, not readable by the caller, or Docs collaboration is off.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/documents/:id/comment-anchors')
	public async list(@Param('id', UUIDValidationPipe) id: ID, @Query() query: DocumentScopeQueryDTO): Promise<IDocumentCommentAnchorList> {
		return this.anchors.list(id, query?.organizationId);
	}

	@ApiOperation({ summary: 'Set where a comment of the page was made (its author only).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The anchor, with where it is now.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'An anchor that cannot be stored, or a reply.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the author of the comment, or the page takes no comments from the caller.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such page or comment of the page.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/documents/:id/comments/:commentId/anchor')
	public async set(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('commentId', UUIDValidationPipe) commentId: ID,
		@Body() input: SetDocumentCommentAnchorDTO
	): Promise<IDocumentCommentAnchorResolved> {
		const { organizationId, tenantId: _tenantId, ...anchor } = input as SetDocumentCommentAnchorDTO & { tenantId?: ID };
		return this.anchors.set(id, commentId, anchor, organizationId);
	}

	@ApiOperation({ summary: "Remove a comment's anchor (its author only): the comment is on its block again." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Whether an anchor was removed.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@HttpCode(HttpStatus.OK)
	@Delete('/documents/:id/comments/:commentId/anchor')
	public async remove(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('commentId', UUIDValidationPipe) commentId: ID,
		@Query() query: DocumentScopeQueryDTO
	): Promise<{ removed: boolean }> {
		return { removed: await this.anchors.remove(id, commentId, query?.organizationId) };
	}
}
