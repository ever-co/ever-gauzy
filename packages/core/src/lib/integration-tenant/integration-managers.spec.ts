import '../core/entities/internal';

import { In } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { findIntegrationManagerUserIds, INTEGRATION_MANAGERS_LIMIT } from './integration-managers';

/**
 * The integration's managers: the people a task integration tells in their Inbox when a provider refuses its token.
 * Active members of the organization whose role grants adding or editing integrations, read with explicit scope.
 */
describe('findIntegrationManagerUserIds', () => {
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

	it('reads active members of the organization whose role (in the tenant) may add or edit integrations', async () => {
		const find = jest.fn().mockResolvedValue([{ userId: 'u-1' }, { userId: 'u-2' }]);
		const ids = await findIntegrationManagerUserIds({ find } as never, scope);
		expect(ids).toEqual(['u-1', 'u-2']);
		expect(find).toHaveBeenCalledWith(
			UserOrganization,
			expect.objectContaining({
				where: {
					tenantId: 'tenant-1',
					organizationId: 'org-1',
					isActive: true,
					isArchived: false,
					user: {
						isActive: true,
						role: {
							tenantId: 'tenant-1',
							rolePermissions: { tenantId: 'tenant-1', permission: In([PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT]), enabled: true }
						}
					}
				},
				take: INTEGRATION_MANAGERS_LIMIT
			})
		);
	});

	it('names each user once and skips a membership without a user', async () => {
		const find = jest.fn().mockResolvedValue([{ userId: 'u-1' }, { userId: null }, { userId: 'u-1' }]);
		expect(await findIntegrationManagerUserIds({ find } as never, scope)).toEqual(['u-1']);
	});

	it('reads nothing without a tenant and an organization', async () => {
		const find = jest.fn();
		expect(await findIntegrationManagerUserIds({ find } as never, { tenantId: '', organizationId: 'org-1' })).toEqual([]);
		expect(find).not.toHaveBeenCalled();
	});
});
