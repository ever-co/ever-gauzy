import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID as Id, IComment, IDocumentCommentAnchorInput, IDocumentCommentAnchorList, IDocumentCommentAnchorResolved, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_GRAPHQL, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { DocumentCommentAnchorService, IAnchorContent } from '../services/document-comment-anchor.service';

/**
 * The comment anchors of Docs pages over GraphQL: the same service, the same rules and the same permission as the
 * REST routes of `DocumentCommentAnchorController` (`DOCS_READ`, the page's own access, the comment's author). An
 * `organizationId` argument must name an organization the caller reaches, as the REST routes' DTO checks it.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
export class DocsCommentAnchorResolver {
	constructor(private readonly anchors: DocumentCommentAnchorService) {}

	@Permissions(PermissionsEnum.DOCS_READ)
	@Query('documentCommentAnchors')
	async documentCommentAnchors(
		@Args('documentId', { type: () => ID }) documentId: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<IDocumentCommentAnchorList> {
		await this.anchors.assertOrganization(organizationId);
		return this.anchors.list(documentId, organizationId ?? undefined);
	}

	@Permissions(PermissionsEnum.DOCS_READ)
	@Mutation('setDocumentCommentAnchor')
	async setDocumentCommentAnchor(
		@Args('documentId', { type: () => ID }) documentId: Id,
		@Args('commentId', { type: () => ID }) commentId: Id,
		@Args('input') input: IDocumentCommentAnchorInput,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<IDocumentCommentAnchorResolved> {
		await this.anchors.assertOrganization(organizationId);
		return this.anchors.set(documentId, commentId, input, organizationId ?? undefined);
	}

	@Permissions(PermissionsEnum.DOCS_READ)
	@Mutation('removeDocumentCommentAnchor')
	async removeDocumentCommentAnchor(
		@Args('documentId', { type: () => ID }) documentId: Id,
		@Args('commentId', { type: () => ID }) commentId: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<boolean> {
		await this.anchors.assertOrganization(organizationId);
		return this.anchors.remove(documentId, commentId, organizationId ?? undefined);
	}
}

/** The pages one GraphQL request has read for its comments' anchors, so a list of comments reads each page once. */
const PAGES_OF_REQUEST = Symbol('docsCommentAnchorPages');

/**
 * `Comment.documentAnchor`: the range of a comment of a Docs page, beside the platform's own comment fields. The
 * comment was read under the comment API's rules; its page is read again under the page's (no range for a page the
 * caller may not read). The class carries the anchor queries' feature codes for the feature-gate check, but Nest runs no
 * guard on a `@ResolveField` (the GraphQL module sets no `fieldResolverEnhancers`), so `ofComment` resolves
 * `FEATURE_DOCUMENTS` itself as the guard does (null where Docs is off); the comment it is on was read behind
 * `FEATURE_GRAPHQL` already.
 */
@Resolver('Comment')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
export class DocsCommentAnchorFieldResolver {
	constructor(private readonly anchors: DocumentCommentAnchorService) {}

	@ResolveField('documentAnchor')
	documentAnchor(@Parent() comment: IComment, @Context() context: Record<string | symbol, unknown>): Promise<IDocumentCommentAnchorResolved | null> {
		const holder = (context ?? {}) as Record<symbol, Map<string, Promise<IAnchorContent | null>>>;
		if (!holder[PAGES_OF_REQUEST]) {
			holder[PAGES_OF_REQUEST] = new Map();
		}
		return this.anchors.ofComment(comment, holder[PAGES_OF_REQUEST]).catch(() => null);
	}
}
