import '../core/entities/internal';

import { IIntegrationSetting } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { IntegrationSettingService } from './integration-setting.service';

/**
 * `bulkUpdateOrCreate` replaces an integration's settings: it deletes the stored ones, then saves the new ones.
 *
 * The Make.com OAuth callback is a public route, so there is no user in context. Its update-or-create now
 * finds the integration tenant (#10666) and replaces that tenant's settings, where it used to create a second
 * integration tenant. The tenant-aware delete fails when there is no user, and the failure was swallowed, so the
 * tokens from the callback were dropped while the callback reported success.
 */
describe('IntegrationSettingService.bulkUpdateOrCreate', () => {
	const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
	const INTEGRATION_ID = 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0';

	const tokens = (tenantId: string): IIntegrationSetting[] =>
		[
			{ settingsName: 'access_token', settingsValue: 'new-access', tenantId, integrationId: INTEGRATION_ID },
			{ settingsName: 'refresh_token', settingsValue: 'new-refresh', tenantId, integrationId: INTEGRATION_ID }
		] as IIntegrationSetting[];

	let repository: { metadata: unknown; delete: jest.Mock; save: jest.Mock };
	let service: IntegrationSettingService;

	beforeEach(() => {
		repository = {
			metadata: { hasColumnWithPropertyPath: (path: string) => path === 'tenantId' },
			delete: jest.fn(async () => ({ affected: 2, raw: [] })),
			save: jest.fn(async (settings: IIntegrationSetting[]) => settings)
		};
		service = new IntegrationSettingService(repository as any, {} as any);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('replaces the settings of an OAuth callback that has no user in context', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);

		const saved = await service.bulkUpdateOrCreate(INTEGRATION_ID, tokens(TENANT_A));

		expect(repository.delete).toHaveBeenCalledWith({ integrationId: INTEGRATION_ID, tenantId: TENANT_A });
		expect(repository.save).toHaveBeenCalledWith(tokens(TENANT_A));
		expect(saved).toEqual(tokens(TENANT_A));
	});

	it('scopes the delete to the user’s tenant when a user is in context', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-a', tenantId: TENANT_A } as any);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);

		// The settings name another tenant, so this case tells the two branches apart: with a user, the user's
		// tenant bounds the delete and the settings' tenant does not.
		await service.bulkUpdateOrCreate(INTEGRATION_ID, tokens(TENANT_B));

		expect(repository.delete).toHaveBeenCalledTimes(1);
		expect(repository.delete).toHaveBeenCalledWith(
			expect.objectContaining({ integrationId: INTEGRATION_ID, tenantId: TENANT_A })
		);
		expect(repository.save).toHaveBeenCalledWith(tokens(TENANT_B));
	});

	it('takes a single setting as well as a list', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
		const [one] = tokens(TENANT_A);

		await service.bulkUpdateOrCreate(INTEGRATION_ID, one);

		expect(repository.delete).toHaveBeenCalledWith({ integrationId: INTEGRATION_ID, tenantId: TENANT_A });
		expect(repository.save).toHaveBeenCalledWith([one]);
	});
});
