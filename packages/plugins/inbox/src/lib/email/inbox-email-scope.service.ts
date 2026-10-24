import { ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, UserOrganization } from '@gauzy/core';

/** The caller's tenant, user and organization, after the membership check. */
export interface InboxEmailScope {
	tenantId: ID;
	userId: ID;
	organizationId: ID;
}

/**
 * The organization-membership check of the email management routes: a signed-in user of the tenant, a valid
 * organization id (the `organizationId` parameter, else the request's selected organization), and an active
 * membership of that user in that organization. The tenant always comes from the request context, never from the
 * request body or query.
 */
@Injectable()
export class InboxEmailScopeService {
	constructor(private readonly dataSource: DataSource) {}

	async resolve(organizationId?: ID | null): Promise<InboxEmailScope> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		const orgId = organizationId ?? RequestContext.currentOrganizationId() ?? undefined;
		if (!tenantId || !userId || !orgId || !isUUID(orgId)) {
			throw new ForbiddenException('An authenticated organization context is required.');
		}
		const membership = await this.dataSource.getRepository(UserOrganization).findOneBy({
			tenantId,
			organizationId: orgId,
			userId,
			isActive: true,
			isArchived: false
		});
		if (!membership) {
			throw new ForbiddenException('Access to this organization is required.');
		}
		return { tenantId, userId, organizationId: orgId };
	}
}
