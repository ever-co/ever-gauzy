import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../../core/context';
import { IntegrationSettingUpdateCommand } from '../../../integration-setting/commands';
import { IntegrationTenantUpdateHandler } from './integration-tenant.update.handler';

/**
 * Q8a (D4 class): `IntegrationTenantUpdateHandler` read and wrote a connection by its id under the tenant alone. The
 * organization a caller states is checked for membership on both protocols (`@IsOrganizationBelongsToUser()` on the
 * REST DTO, `GraphqlOrganizationMembershipInterceptor` on GraphQL) — and then never compared with the connection's:
 * a caller of organization A stating A changed organization B's connection (`PUT /integration-tenant/:id`,
 * `updateIntegrationTenant`, which dispatch this command), and its settings were written stamped with A.
 */
describe('IntegrationTenantUpdateHandler — the stated organization is the connection’s (Q8a)', () => {
	const TENANT = '00000000-0000-4000-8000-0000000000a1';
	const ORG_A = '00000000-0000-4000-8000-0000000000a2';
	const ORG_B = '00000000-0000-4000-8000-0000000000a3';
	const CONNECTION = '00000000-0000-4000-8000-0000000000a4';

	/** One connection of organization B, read the way the tenant-aware service reads it. */
	function fixture() {
		const row = { id: CONNECTION, tenantId: TENANT, organizationId: ORG_B, isActive: true, isArchived: false };
		const service = {
			findOneByIdString: jest.fn(async (id: string, options?: { where?: Record<string, unknown> }) => {
				const where = options?.where ?? {};

				if (id !== row.id || (where['organizationId'] && where['organizationId'] !== row.organizationId)) {
					throw new NotFoundException('The requested record was not found');
				}

				return { ...row };
			}),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		const commandBus = { execute: jest.fn(async () => []) };
		const handler = new IntegrationTenantUpdateHandler(commandBus as never, service as never);

		return { row, service, commandBus, handler };
	}

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a connection of another organization than the one stated, and writes nothing', async () => {
		const { service, commandBus, handler } = fixture();

		await expect(
			handler.update(CONNECTION, {
				organizationId: ORG_A,
				isActive: false,
				settings: [{ settingsName: 'apiKey', settingsValue: 'planted' }]
			} as never)
		).rejects.toThrow(/not found/i);

		expect(service.update).not.toHaveBeenCalled();
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('changes the stated organization’s own connection, predicated on that organization', async () => {
		const { service, handler } = fixture();

		await handler.update(CONNECTION, { organizationId: ORG_B, isActive: false, isArchived: true } as never);

		expect(service.update).toHaveBeenCalledWith(
			{ id: CONNECTION, organizationId: ORG_B },
			{ isActive: false, isArchived: true }
		);
	});

	it('stamps the settings with the connection’s own organization', async () => {
		const { commandBus, handler } = fixture();

		await handler.update(CONNECTION, {
			organizationId: ORG_B,
			settings: [{ settingsName: 'apiKey', settingsValue: 'mine' }]
		} as never);

		const command = commandBus.execute.mock.calls[0][0] as IntegrationSettingUpdateCommand;

		expect(command).toBeInstanceOf(IntegrationSettingUpdateCommand);
		expect((command as any).input).toEqual([
			expect.objectContaining({ integrationId: CONNECTION, tenantId: TENANT, organizationId: ORG_B })
		]);
	});

	it('CONTROL: with no organization stated the connection is read under the tenant, as before', async () => {
		const { service, handler } = fixture();

		await handler.update(CONNECTION, { isActive: false } as never);

		expect(service.findOneByIdString).toHaveBeenCalledWith(CONNECTION, { where: {} });
		// The statement is still predicated on the organization the row was read in.
		expect(service.update).toHaveBeenCalledWith(
			{ id: CONNECTION, organizationId: ORG_B },
			{ isActive: false, isArchived: undefined }
		);
	});
});
