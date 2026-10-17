// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Every name it
// gives these files is replaced by a stand-in usable as a class, a decorator factory or a helper.
jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		// Called as a decorator factory: hand back a no-op decorator
		return new.target ? undefined : () => undefined;
	}
	return new Proxy({ DEFAULT_ENTITY_SETTINGS: [], PROJECT_TIED_ENTITIES: [] } as Record<string, unknown>, {
		get: (target, name: string) => (name in target ? target[name] : name === '__esModule' ? true : stub)
	});
});

import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ZapierWebhookController } from './zapier-webhook.controller';
import { ZapierWebhookService } from './zapier-webhook.service';

/**
 * Unsubscribing a Zapier webhook answered 500 for every refusal: an unknown subscription, another tenant's,
 * or an invalid token were all rethrown as InternalServerErrorException by the service and the controller.
 */
describe('Zapier webhook deletion keeps its client errors', () => {
	const subscriptionOf = (tenantId: string | null) =>
		tenantId ? { id: 'subscription-1', tenantId } : null;

	const build = (subscription: unknown, integration: unknown = { tenantId: 'tenant-1' }) => {
		const repository = {
			findOne: jest.fn().mockResolvedValue(subscription),
			delete: jest.fn().mockResolvedValue({ affected: 1 })
		};
		const service = new ZapierWebhookService(repository as any, {} as any);
		const zapierService = { resolveIntegrationFromBearerToken: jest.fn().mockResolvedValue(integration) };
		const controller = new ZapierWebhookController(service, zapierService as any);
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		jest.spyOn((controller as any).logger, 'error').mockImplementation(() => undefined);
		return { service, controller, repository };
	};

	afterEach(() => jest.restoreAllMocks());

	it('answers 404 for an unknown subscription', async () => {
		const { service } = build(subscriptionOf(null));
		await expect(service.deleteSubscription('subscription-1', 'tenant-1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it("answers 403 for another tenant's subscription, through the controller too", async () => {
		const { controller, repository } = build(subscriptionOf('tenant-2'));
		await expect(controller.deleteWebhook('subscription-1', 'Bearer token')).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(repository.delete).not.toHaveBeenCalled();
	});

	it('answers 403 for a token matching no integration', async () => {
		const { controller } = build(subscriptionOf('tenant-1'), null);
		await expect(controller.deleteWebhook('subscription-1', 'Bearer token')).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('still answers 500 for an unexpected failure', async () => {
		const { controller, repository } = build(subscriptionOf('tenant-1'));
		repository.delete.mockRejectedValue(new Error('connection lost'));
		await expect(controller.deleteWebhook('subscription-1', 'Bearer token')).rejects.toBeInstanceOf(
			InternalServerErrorException
		);
	});
});
