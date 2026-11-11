import { EntityManager, In } from 'typeorm';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { UserOrganization } from '../user-organization/user-organization.entity';

/** The permissions that make someone a manager of an organization's integrations: they may connect one again. */
export const INTEGRATION_MANAGER_PERMISSIONS: readonly PermissionsEnum[] = [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT];

/** At most this many memberships are read for one connection (an organization with more is told through the first ones). */
export const INTEGRATION_MANAGERS_LIMIT = 100;

/** The managers read for a connection, and whether the read stopped at {@link INTEGRATION_MANAGERS_LIMIT} (some may be missing). */
export interface IntegrationManagers {
	userIds: ID[];
	truncated: boolean;
}

/**
 * The users who manage an organization's integrations: active members of the organization whose role (in the
 * tenant) grants {@link INTEGRATION_MANAGER_PERMISSIONS} (enabled). Read with explicit scope, so it works with no
 * request context (a scheduled sweep). Each user once, oldest membership first. One membership more than the limit
 * is read, so `truncated` says exactly whether managers were left out (whatever duplicate memberships the page holds).
 */
export async function findIntegrationManagers(manager: EntityManager, scope: { tenantId: ID; organizationId: ID }): Promise<IntegrationManagers> {
	if (!scope.tenantId || !scope.organizationId) return { userIds: [], truncated: false };
	const memberships = (await manager.find(UserOrganization, {
		where: {
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			isActive: true,
			isArchived: false,
			user: {
				isActive: true,
				role: { tenantId: scope.tenantId, rolePermissions: { tenantId: scope.tenantId, permission: In([...INTEGRATION_MANAGER_PERMISSIONS]), enabled: true } }
			}
		},
		select: { id: true, userId: true },
		order: { createdAt: 'ASC' },
		take: INTEGRATION_MANAGERS_LIMIT + 1
	} as never)) as UserOrganization[];
	const truncated = memberships.length > INTEGRATION_MANAGERS_LIMIT;
	const userIds = [...new Set(memberships.slice(0, INTEGRATION_MANAGERS_LIMIT).map((membership) => membership.userId).filter(Boolean).map(String))] as ID[];
	return { userIds, truncated };
}
