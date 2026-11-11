import '../core/entities/internal';

import { In } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { findIntegrationManagers, INTEGRATION_MANAGERS_LIMIT } from './integration-managers';

/**
 * The integration's managers: the people a task integration tells in their Inbox when a provider refuses its token.
 * Active members of the organization whose role grants adding or editing integrations, read with explicit scope.
 */
describe('findIntegrationManagers', () => {
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

	it('reads active members of the organization whose role (in the tenant) may add or edit integrations', async () => {
		const find = jest.fn().mockResolvedValue([{ userId: 'u-1' }, { userId: 'u-2' }]);
		expect(await findIntegrationManagers({ find } as never, scope)).toEqual({ userIds: ['u-1', 'u-2'], truncated: false });
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
				// One more than the limit: whether managers were left out is known exactly.
				take: INTEGRATION_MANAGERS_LIMIT + 1
			})
		);
	});

	it('names each user once and skips a membership without a user', async () => {
		const find = jest.fn().mockResolvedValue([{ userId: 'u-1' }, { userId: null }, { userId: 'u-1' }]);
		expect(await findIntegrationManagers({ find } as never, scope)).toEqual({ userIds: ['u-1'], truncated: false });
	});

	it('says the read was cut when more memberships than the limit exist, even when duplicates shrink the page', async () => {
		const memberships = Array.from({ length: INTEGRATION_MANAGERS_LIMIT + 1 }, (_, index) => ({ userId: index % 2 ? 'u-twin' : `u-${index}` }));
		const found = await findIntegrationManagers({ find: jest.fn().mockResolvedValue(memberships) } as never, scope);
		expect(found.truncated).toBe(true);
		expect(found.userIds.length).toBeLessThan(INTEGRATION_MANAGERS_LIMIT);
		const exact = await findIntegrationManagers({ find: jest.fn().mockResolvedValue(memberships.slice(0, INTEGRATION_MANAGERS_LIMIT)) } as never, scope);
		expect(exact.truncated).toBe(false);
	});

	it('reads nothing without a tenant and an organization', async () => {
		const find = jest.fn();
		expect(await findIntegrationManagers({ find } as never, { tenantId: '', organizationId: 'org-1' })).toEqual({ userIds: [], truncated: false });
		expect(find).not.toHaveBeenCalled();
	});
});
