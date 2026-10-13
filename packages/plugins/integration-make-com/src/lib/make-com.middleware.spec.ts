// Only the injected service's type is needed: keep the rest of @gauzy/core (database, seeds) out of this test
jest.mock('@gauzy/core', () => ({
	IntegrationTenantService: class IntegrationTenantService {}
}));

import { MakeComMiddleware } from './make-com.middleware';

/**
 * The cache store takes its TTL in milliseconds. The Make.com middleware passed `5 * 60` ("5 min expressed in
 * seconds"), i.e. 300 ms, so the integration settings were read from the database on every request.
 */
describe('MakeComMiddleware settings cache', () => {
	it('caches the integration settings for five minutes', async () => {
		const settings = [{ settingsName: 'webhook_url', settingsValue: 'https://hook.example' }];
		const cacheManager = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
		const integrationTenantService = { findOneByIdString: jest.fn().mockResolvedValue({ settings }) };
		const middleware = new MakeComMiddleware(cacheManager as never, integrationTenantService as never);
		const request = {
			params: { integrationId: 'integration-1' },
			query: { tenantId: 'tenant-1', organizationId: 'org-1' },
			header: jest.fn()
		};
		const next = jest.fn();

		await middleware.use(request as never, {} as never, next);

		expect(cacheManager.set).toHaveBeenCalledWith(
			'integrationTenantSettings_tenant-1_org-1_integration-1',
			settings,
			5 * 60 * 1000
		);
		expect(next).toHaveBeenCalledWith();
	});
});
