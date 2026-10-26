import { ForbiddenException } from '@nestjs/common';

jest.mock('@gauzy/core', () => ({
	IntegrationTenantService: class IntegrationTenantService {},
	RequestContext: { currentTenantId: jest.fn() }
}));

import { RequestContext } from '@gauzy/core';
import { GithubMiddleware } from './github.middleware';
import { GithubIntegrationTenantGuard } from './github-integration-tenant.guard';

/**
 * GHSA-4rwq-65wh-45h4 — the GitHub integration routes must act only on the CALLER's installation.
 *
 * `GithubMiddleware` loads an integration's settings (including the App `installation_id` the handler
 * then uses) before authentication, taking the tenant from `?tenantId=` ahead of the `Tenant-Id`
 * header. The tenant guard validates only the header when one is sent. So a request carrying the
 * caller's own tenant in the header and a victim's in the query passed the guard while the handler
 * listed, read or synced the victim's repositories.
 */
describe('GitHub integration routes are bound to the caller tenant (GHSA-4rwq-65wh-45h4)', () => {
	const MINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const VICTIM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
	const VICTIM_ORG = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
	const INTEGRATION_ID = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';

	const victimSettings = [
		{ settingsName: 'installation_id', settingsValue: '424242', tenantId: VICTIM, organizationId: VICTIM_ORG },
		{ settingsName: 'setup_action', settingsValue: 'install', tenantId: VICTIM, organizationId: VICTIM_ORG }
	];

	const buildMiddleware = (settings: unknown[] = victimSettings) => {
		const cache = { get: jest.fn(async () => undefined), set: jest.fn(async () => undefined) };
		const integrationTenantService = { findOneByIdString: jest.fn(async () => ({ settings })) };
		const middleware = new GithubMiddleware(cache as any, integrationTenantService as any);
		return { middleware, integrationTenantService };
	};

	/** The attack request: own tenant in the header (what the tenant guard checks), victim's in the query. */
	const attackRequest = () => ({
		params: { integrationId: INTEGRATION_ID },
		query: { tenantId: VICTIM, organizationId: VICTIM_ORG },
		header: (name: string) => (name === 'Tenant-Id' ? MINE : undefined),
		path: '/integration/github/x/repositories',
		url: '/integration/github/x/repositories'
	});

	it("CONTROL: the middleware loads the tenant named in the QUERY, even when the header names the caller's", async () => {
		const { middleware, integrationTenantService } = buildMiddleware();
		const request: any = attackRequest();

		await middleware.use(request, {} as any, jest.fn());

		expect(integrationTenantService.findOneByIdString).toHaveBeenCalledWith(
			INTEGRATION_ID,
			expect.objectContaining({ where: expect.objectContaining({ tenantId: VICTIM }) })
		);
		expect(request.integration.settings.installation_id).toBe('424242');
	});

	it('records which tenant owns the loaded settings', async () => {
		const { middleware } = buildMiddleware();
		const request: any = attackRequest();

		await middleware.use(request, {} as any, jest.fn());

		expect(request.integration).toMatchObject({ tenantId: VICTIM, organizationId: VICTIM_ORG });
	});

	it('attaches nothing when the owner of the settings cannot be determined', async () => {
		const { middleware } = buildMiddleware([{ settingsName: 'installation_id', settingsValue: '1' }]);
		const request: any = attackRequest();

		await middleware.use(request, {} as any, jest.fn());

		expect(request.integration).toBeUndefined();
	});

	describe('GithubIntegrationTenantGuard', () => {
		const guard = new GithubIntegrationTenantGuard();
		const contextFor = (request: unknown) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

		it("refuses to let a caller act on another tenant's integration", () => {
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(MINE);

			expect(() => guard.canActivate(contextFor({ integration: { tenantId: VICTIM, settings: {} } }))).toThrow(
				ForbiddenException
			);
		});

		it("allows the caller's own integration", () => {
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(MINE);

			expect(guard.canActivate(contextFor({ integration: { tenantId: MINE, settings: {} } }))).toBe(true);
		});

		it('fails closed when the owner or the caller tenant is unknown', () => {
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(MINE);
			expect(() => guard.canActivate(contextFor({ integration: { settings: {} } }))).toThrow(ForbiddenException);

			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(null);
			expect(() => guard.canActivate(contextFor({ integration: { tenantId: MINE, settings: {} } }))).toThrow(
				ForbiddenException
			);
		});

		it('leaves routes the middleware does not serve untouched', () => {
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(MINE);

			expect(guard.canActivate(contextFor({}))).toBe(true);
		});
	});
});
