import { UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	deliverPayloadAsIs,
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard
} from '@gauzy/core';
import { DocumentLiveService } from '../document-live.service';
import { IDocumentLiveFrame } from '../document-live.types';

/**
 * `Subscription.documentLive`: the server's half of a live editing session of a Docs page.
 *
 * The body runs after the guards, in the subscriber's request context (the socket opens one per operation), which is
 * what the session keeps for its access re-checks and for the persist of its edits.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
export class DocsLiveResolver {
	constructor(private readonly live: DocumentLiveService) {}

	@Permissions(PermissionsEnum.DOCS_READ)
	@Subscription('documentLive', { resolve: deliverPayloadAsIs })
	documentLive(
		@Args('documentId', { type: () => ID }) documentId: string,
		@Args('connectionId', { type: () => String }) connectionId: string
	): Promise<AsyncIterableIterator<IDocumentLiveFrame>> {
		return this.live.open(documentId, connectionId);
	}
}
