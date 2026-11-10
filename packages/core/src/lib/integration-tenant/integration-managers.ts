import { EntityManager, In } from 'typeorm';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { UserOrganization } from '../user-organization/user-organization.entity';

/** The permissions that make someone a manager of an organization's integrations: they may connect one again. */
export const INTEGRATION_MANAGER_PERMISSIONS: readonly PermissionsEnum[] = [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT];

/** At most this many managers are told of one connection (an organization with more is told through the first ones). */
export const INTEGRATION_MANAGERS_LIMIT = 100;

/**
 * The users who manage an organization's integrations: active members of the organization whose role grants
 * {@link INTEGRATION_MANAGER_PERMISSIONS} (enabled). Read with explicit scope, so it works with no request
 * context (a scheduled sweep). Each user once, oldest membership first.
 */
export async function findIntegrationManagerUserIds(manager: EntityManager, scope: { tenantId: ID; organizationId: ID }): Promise<ID[]> {
	if (!scope.tenantId || !scope.organizationId) return [];
	const memberships = await manager.find(UserOrganization, {
		where: {
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			isActive: true,
			isArchived: false,
			user: {
				isActive: true,
				role: { rolePermissions: { permission: In([...INTEGRATION_MANAGER_PERMISSIONS]), enabled: true } }
			}
		},
		select: { id: true, userId: true },
		order: { createdAt: 'ASC' },
		take: INTEGRATION_MANAGERS_LIMIT
	} as never);
	return [...new Set((memberships as UserOrganization[]).map((membership) => membership.userId).filter(Boolean).map(String))] as ID[];
}
