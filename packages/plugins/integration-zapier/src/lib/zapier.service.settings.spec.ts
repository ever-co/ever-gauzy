// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Every name it
// gives this file is replaced by a stand-in; the service only reads the current tenant from it here.
jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		// Called as a decorator factory: hand back a no-op decorator
		return new.target ? undefined : () => undefined;
	}
	return new Proxy(
		{
			DEFAULT_ENTITY_SETTINGS: [],
			PROJECT_TIED_ENTITIES: [],
			RequestContext: { currentTenantId: () => 'tenant-1' }
		} as Record<string, unknown>,
		{
			get: (target, name: string) => (name in target ? target[name] : name === '__esModule' ? true : stub)
		}
	);
});

import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ZapierService } from './zapier.service';

/**
 * `findOneByOptions` throws NotFoundException on a miss and never answers null, so the "not configured"
 * default was unreachable: a tenant without the integration got a 404 instead of the default.
 */
describe('ZapierService.getIntegrationSettings', () => {
	const build = (findOneByOptions: jest.Mock, zapierConfig: Record<string, string> = {}) => {
		const config = { get: jest.fn().mockReturnValue(zapierConfig) };
		const service = new ZapierService(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ findOneByOptions } as any,
			config as any,
			{} as any
		);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		return service;
	};

	afterEach(() => jest.restoreAllMocks());

	it('answers the "not configured" default when the tenant has no Zapier integration', async () => {
		const service = build(jest.fn().mockRejectedValue(new NotFoundException()));

		await expect(service.getIntegrationSettings()).resolves.toEqual({
			isEnabled: false,
			hasClientCredentials: false,
			hasAccessToken: false,
			hasRefreshToken: false,
			webhookUrl: null
		});
	});

	it('reads the stored settings when the integration exists', async () => {
		const settings = [
			{ settingsName: 'is_enabled', settingsValue: 'true' },
			{ settingsName: 'zapier_access_token', settingsValue: 'access' }
		];
		const service = build(jest.fn().mockResolvedValue({ settings }), { clientId: 'id', clientSecret: 'secret' });

		await expect(service.getIntegrationSettings()).resolves.toEqual({
			isEnabled: true,
			hasClientCredentials: true,
			hasAccessToken: true,
			hasRefreshToken: false,
			webhookUrl: null
		});
	});

	it('still rethrows other errors', async () => {
		const service = build(jest.fn().mockRejectedValue(new InternalServerErrorException()));

		await expect(service.getIntegrationSettings()).rejects.toBeInstanceOf(InternalServerErrorException);
	});
});
