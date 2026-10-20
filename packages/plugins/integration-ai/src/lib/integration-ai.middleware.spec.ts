// `@gauzy/core` drags in the whole entity graph: the middleware only needs the integration tenant service's type.
jest.mock('@gauzy/core', () => ({ IntegrationTenantService: class IntegrationTenantService {} }));

import { bearerTenantId, IntegrationAIMiddleware } from './integration-ai.middleware';

/**
 * The middleware loads a tenant's Gauzy AI and OpenAI keys for the job routes before authentication runs. It took
 * the tenant from the `tenant-id` header or the body, so a user of one tenant could have another tenant's keys used
 * for their requests. It now reads the tenant from the bearer token's own claim.
 */
const token = (claims: object) =>
	`Bearer ${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(
		JSON.stringify(claims)
	).toString('base64url')}.signature`;

describe('bearerTenantId', () => {
	it('reads the tenantId claim of a bearer token', () => {
		expect(bearerTenantId(token({ id: 'user-1', tenantId: 'tenant-1' }))).toBe('tenant-1');
	});

	it.each([
		['no header', undefined],
		['another scheme', 'Basic dXNlcjpwYXNz'],
		['a token that is not a JWT', 'Bearer abc'],
		['a payload that is not JSON', 'Bearer a.bm90LWpzb24.c'],
		['no tenant claim', token({ id: 'user-1' })],
		['a tenant claim that is not a string', token({ tenantId: { $ne: null } })]
	])('answers no tenant for %s', (_case, header) => {
		expect(bearerTenantId(header)).toBeUndefined();
	});
});

describe('IntegrationAIMiddleware', () => {
	const build = () => {
		const integrationTenantService = { getIntegrationTenantSettings: jest.fn().mockResolvedValue(null) };
		const cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
		const config = { resetConfig: jest.fn(), setConfig: jest.fn() };
		const middleware = new IntegrationAIMiddleware(cache as any, integrationTenantService as any, config as any);
		return { middleware, integrationTenantService };
	};

	const request = (headers: Record<string, string>, body: object = {}) =>
		({
			headers: {},
			body,
			header: (name: string) => headers[name.toLowerCase()],
			path: '/job-preset',
			url: '/job-preset'
		}) as any;

	it("loads the keys of the token's tenant, whatever tenant the header or the body names", async () => {
		const { middleware, integrationTenantService } = build();
		const next = jest.fn();

		await middleware.use(
			request(
				{
					authorization: token({ id: 'user-1', tenantId: 'tenant-1' }),
					'tenant-id': 'tenant-2',
					'organization-id': 'organization-1'
				},
				{ tenantId: 'tenant-3' }
			),
			{} as any,
			next
		);

		expect(integrationTenantService.getIntegrationTenantSettings).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'tenant-1', organizationId: 'organization-1' })
		);
		expect(next).toHaveBeenCalled();
	});

	it('loads no keys for a request without a bearer token, even when a header names a tenant', async () => {
		const { middleware, integrationTenantService } = build();
		const next = jest.fn();

		await middleware.use(
			request({ 'tenant-id': 'tenant-2', 'organization-id': 'organization-1' }),
			{} as any,
			next
		);

		expect(integrationTenantService.getIntegrationTenantSettings).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalled();
	});
});
