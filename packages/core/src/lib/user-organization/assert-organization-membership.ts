import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TENANT_ADMIN_ROLES } from '../core/crud/organization-boundary';
import { Organization, UserOrganization } from '../core/entities/internal';

/**
 * Refuse a read scoped to an organization the current user may not reach.
 *
 * **The organization boundary (owner decision, 2026-10-22).** A tenant admin (`SUPER_ADMIN`, `ADMIN`) reaches every
 * organization of the tenant, a member of it or not. Anyone else reaches only the organization of their token
 * (`RequestContext.currentOrganizationId()`), and must still be a member of it: another organization they belong to
 * is reached by switching to it. This is the rule `@IsOrganizationBelongsToUser()` applies to the organization a
 * REST DTO or a GraphQL argument names.
 *
 * Services that list through the raw repository cannot lean on the query DTO for this: the
 * `organizationId` membership validator on `TenantOrganizationBaseDTO` is conditional and is
 * skipped entirely whenever the request carries `sentTo`, so a caller could name a sibling
 * organization of their tenant and read it. This repeats the check the validator would have made
 * (a `user_organization` row for this tenant, user and organization) and fails closed when it
 * cannot reach a verdict: no organization, no tenant or no user in the request context all refuse.
 *
 * @param manager the TypeORM entity manager to run the membership lookup with
 * @param organizationId the organization the read is about to be scoped to
 * @throws BadRequestException when no organization is supplied
 * @throws ForbiddenException when there is no authenticated tenant user, or they are not a member
 */
export async function assertCurrentUserBelongsToOrganization(
	manager: EntityManager,
	organizationId?: ID
): Promise<void> {
	if (!organizationId) {
		throw new BadRequestException('organizationId is required');
	}

	const tenantId = RequestContext.currentTenantId();
	const userId = RequestContext.currentUserId();

	if (!tenantId || !userId) {
		throw new ForbiddenException('You are not a member of this organization');
	}

	if (RequestContext.hasRoles([...TENANT_ADMIN_ROLES])) {
		const organizations = await manager.count(Organization, { where: { id: organizationId, tenantId } });
		if (organizations === 0) {
			throw new ForbiddenException('You are not a member of this organization');
		}
		return;
	}

	if (organizationId !== RequestContext.currentOrganizationId()) {
		throw new ForbiddenException('You are not a member of this organization');
	}

	const memberships = await manager.count(UserOrganization, {
		where: { tenantId, userId, organizationId }
	});

	if (memberships === 0) {
		throw new ForbiddenException('You are not a member of this organization');
	}
}

/**
 * Whether a request sent a value: `undefined`, `null` and `''` count as absent, as in `TenantOrganizationBaseDTO`.
 */
export const isSent = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

/**
 * The same check for an organization named in a `?data=` JSON query parameter, which no DTO validates, so
 * neither the `@IsUUID()` nor the `@IsOrganizationBelongsToUser()` rule of `TenantOrganizationBaseDTO` ran.
 *
 * An organization that was not sent is left to the caller. One that was must be a UUID before it is looked
 * up: the reads pass it to the query as it is, where an operator object (MikroORM) or a number (MySQL) can
 * match other organizations' rows.
 *
 * @param manager the TypeORM entity manager to run the membership lookup with
 * @param organizationId the organization the request names, as parsed from its JSON
 * @throws BadRequestException when it is not a UUID
 * @throws ForbiddenException when there is no authenticated tenant user, or they are not a member
 */
export async function assertCurrentUserBelongsToSentOrganization(
	manager: EntityManager,
	organizationId: unknown
): Promise<void> {
	if (!isSent(organizationId)) {
		return;
	}
	if (typeof organizationId !== 'string' || !isUUID(organizationId)) {
		throw new BadRequestException('organizationId must be a UUID');
	}
	await assertCurrentUserBelongsToOrganization(manager, organizationId);
}
