/**
 * Cover for the Upwork client state after GHSA-3rqg-gpm9-gx84 moved credential resolution to the API.
 *
 * The store no longer holds Upwork credentials, so it asks for contracts and configuration by
 * integration and organization id. These specs pin that the requests carry exactly those ids,
 * that the root-singleton caches are tied to the integration and organization they were loaded
 * for, and that the contracts cache (seeded with `[]`) does not block the first load.
 *
 * `Store` is replaced by a token-only class so the spec never loads the Akita store, and the
 * `@gauzy/ui-core/common` barrel is reduced to the two members these services use.
 */
jest.mock('../store/store.service', () => ({ Store: class Store {} }));
jest.mock('@gauzy/ui-core/common', () => ({
	API_PREFIX: '/api',
	isNotEmpty: jest.requireActual('../../../../../common/src/lib/utils/shared-utils').isNotEmpty
}));

import { firstValueFrom, lastValueFrom, of, toArray } from 'rxjs';
import { UpworkService } from './upwork.service';
import { UpworkStoreService } from './upwork-store.service';

const INTEGRATION_ID = 'integration-1';
const ORGANIZATION_ID = 'organization-1';

/**
 * Wires a store against a recording HTTP double and a selected organization.
 *
 * @param organizationId The organization selected in the header.
 * @returns The store, the real `UpworkService` it talks through and the HTTP double.
 */
function setup(organizationId: string = ORGANIZATION_ID) {
	const http: any = {
		get: jest.fn((url: string) =>
			of(url.includes('/config/') ? { integrationId: INTEGRATION_ID } : [{ reference: 'c-1' }])
		),
		post: jest.fn(() => of([]))
	};
	const storeService: any = { selectedOrganization: { id: organizationId, tenantId: 'tenant-1' } };
	const upworkService = new UpworkService(http);
	const store = new UpworkStoreService(upworkService, storeService);

	return { store, http, storeService };
}

/**
 * Parses the `data` query parameter a GET request was made with.
 *
 * @param call The recorded `HttpClient.get` call.
 * @returns The decoded query object.
 */
const queryData = (call: any[]): any => JSON.parse(call[1].params.data);

describe('UpworkStoreService', () => {
	describe('getContracts', () => {
		it('loads the contracts on first use although the cache is seeded with an empty list', async () => {
			const { store, http } = setup();
			store.setSelectedIntegrationId(INTEGRATION_ID);

			const emitted = await lastValueFrom(store.getContracts().pipe(toArray()));

			expect(emitted).toEqual([[{ reference: 'c-1' }]]);
			expect(http.get).toHaveBeenCalledTimes(1);
			expect(queryData(http.get.mock.calls[0])).toEqual({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID
			});
			expect(await firstValueFrom(store.contracts$)).toEqual([{ reference: 'c-1' }]);
		});

		it('reuses the cache for the same integration and organization', async () => {
			const { store, http } = setup();
			store.setSelectedIntegrationId(INTEGRATION_ID);

			await lastValueFrom(store.getContracts().pipe(toArray()));
			await lastValueFrom(store.getContracts().pipe(toArray()));

			expect(http.get).toHaveBeenCalledTimes(1);
		});

		it('reloads when another organization is selected', async () => {
			const { store, http, storeService } = setup();
			store.setSelectedIntegrationId(INTEGRATION_ID);
			await lastValueFrom(store.getContracts().pipe(toArray()));

			storeService.selectedOrganization = { id: 'organization-2' };
			await lastValueFrom(store.getContracts().pipe(toArray()));

			expect(http.get).toHaveBeenCalledTimes(2);
			expect(queryData(http.get.mock.calls[1]).organizationId).toBe('organization-2');
		});

		it('asks for nothing until an integration is selected', async () => {
			const { store, http } = setup();

			expect(await lastValueFrom(store.getContracts().pipe(toArray()))).toEqual([]);
			expect(http.get).not.toHaveBeenCalled();
		});
	});

	describe('getConfig', () => {
		it('sends the organization only, and reuses the state for the same integration and organization', async () => {
			const { store, http } = setup();

			await lastValueFrom(
				store.getConfig({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID }).pipe(toArray())
			);
			await lastValueFrom(
				store.getConfig({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID }).pipe(toArray())
			);

			expect(http.get).toHaveBeenCalledTimes(1);
			expect(http.get.mock.calls[0][0]).toBe(`/api/integrations/upwork/config/${INTEGRATION_ID}`);
			expect(queryData(http.get.mock.calls[0])).toEqual({ filter: { organizationId: ORGANIZATION_ID } });
		});

		it('does not answer for another integration with the state cached for the first one', async () => {
			const { store, http } = setup();

			await lastValueFrom(
				store.getConfig({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID }).pipe(toArray())
			);
			await lastValueFrom(
				store.getConfig({ integrationId: 'integration-2', organizationId: ORGANIZATION_ID }).pipe(toArray())
			);

			expect(http.get).toHaveBeenCalledTimes(2);
			expect(http.get.mock.calls[1][0]).toBe('/api/integrations/upwork/config/integration-2');
		});
	});

	describe('syncContracts', () => {
		it('posts the integration, organization and contracts, and no tenant', async () => {
			const { store, http } = setup();
			store.setSelectedIntegrationId(INTEGRATION_ID);
			store.setSelectedEmployeeId('employee-1');

			await lastValueFrom(store.syncContracts([{ reference: 'c-1' } as any]));

			expect(http.post).toHaveBeenCalledWith('/api/integrations/upwork/sync-contracts', {
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				contracts: [{ reference: 'c-1' }]
			});
		});
	});
});

describe('UpworkService', () => {
	it('never serializes a stray field of the caller into the contracts request URL', async () => {
		const http: any = { get: jest.fn(() => of([])) };

		await lastValueFrom(
			new UpworkService(http).getContracts({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				config: { accessToken: 'leaked-token' }
			} as any)
		);

		expect(JSON.parse(http.get.mock.calls[0][1].params.data)).toEqual({
			integrationId: INTEGRATION_ID,
			organizationId: ORGANIZATION_ID
		});
	});

	it('never posts a stray field of the caller to the related-data sync', async () => {
		const http: any = { post: jest.fn(() => of([])) };

		await lastValueFrom(
			new UpworkService(http).syncContractsRelatedData({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				contracts: [],
				entitiesToSync: [],
				tenantId: 'tenant-1',
				config: { accessToken: 'leaked-token' }
			} as any)
		);

		const [, body] = http.post.mock.calls[0];
		expect(JSON.stringify(body)).not.toContain('leaked-token');
		expect(body.tenantId).toBeUndefined();
	});
});
