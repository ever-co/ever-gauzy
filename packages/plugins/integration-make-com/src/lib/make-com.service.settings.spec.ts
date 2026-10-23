// `@gauzy/core`'s barrel drags in the whole entity graph; the service only needs stand-ins for its
// DI classes and the current tenant from the request context.
jest.mock('@gauzy/core', () => {
	class Stub {}
	return {
		IntegrationSettingService: Stub,
		IntegrationService: Stub,
		IntegrationTenantService: Stub,
		IntegrationTenantUpdateOrCreateCommand: Stub,
		RequestContext: { currentTenantId: () => 'tenant-1' },
		DEFAULT_ENTITY_SETTINGS: [],
		PROJECT_TIED_ENTITIES: []
	};
});

import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MakeComService } from './make-com.service';
import { MakeSettingName } from './interfaces/make-com.model';

/**
 * `findOneByOptions` throws NotFoundException on a miss and never answers null, so the "not configured"
 * default was unreachable: a tenant without the integration got an empty 200 instead of the default.
 */
describe('MakeComService.getIntegrationSettings', () => {
	const build = (findOneByOptions: jest.Mock) => {
		const service = new MakeComService({} as any, {} as any, {} as any, { findOneByOptions } as any, {} as any);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		return service;
	};

	afterEach(() => jest.restoreAllMocks());

	it('answers the "not configured" default when the tenant has no Make.com integration', async () => {
		const service = build(jest.fn().mockRejectedValue(new NotFoundException()));

		await expect(service.getIntegrationSettings()).resolves.toEqual({ isEnabled: false, webhookUrl: null });
	});

	it('reads the stored settings when the integration exists', async () => {
		const settings = [
			{ settingsName: MakeSettingName.IS_ENABLED, settingsValue: 'true' },
			{ settingsName: MakeSettingName.WEBHOOK_URL, settingsValue: 'https://hook.example' }
		];
		const findOneByOptions = jest.fn().mockResolvedValue({ settings });
		const service = build(findOneByOptions);

		await expect(service.getIntegrationSettings('org-1')).resolves.toEqual({
			isEnabled: true,
			webhookUrl: 'https://hook.example'
		});
		expect(findOneByOptions).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', organizationId: 'org-1' }) })
		);
	});

	it('still rethrows other errors', async () => {
		const service = build(jest.fn().mockRejectedValue(new InternalServerErrorException()));

		await expect(service.getIntegrationSettings()).rejects.toBeInstanceOf(InternalServerErrorException);
	});
});
