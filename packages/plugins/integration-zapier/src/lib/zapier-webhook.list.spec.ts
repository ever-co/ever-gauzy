/**
 * The web app's Zapier webhooks page called `GET /integration/zapier/webhooks`, which the API did not serve. It lists
 * the subscriptions of one integration now: the one the web app names (`integrationId`, read in the caller's tenant
 * for a member of its organization), else the one the Bearer token resolves to, for a member of its organization too.
 *
 * The web app names the integration because its token interceptor always sends the user's session as `Authorization`,
 * whatever Zapier token the page meant to send; the unsubscribe route takes the same `integrationId`.
 */
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

import {
	BadRequestException,
	ForbiddenException,
	InternalServerErrorException,
	NotFoundException,
	RequestMethod,
	UnauthorizedException
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ZapierWebhookController } from './zapier-webhook.controller';
import { ZapierWebhookService } from './zapier-webhook.service';

const INTEGRATION = { id: 'integration-1', tenantId: 'tenant-1', organizationId: 'organization-1' };

describe('GET /integration/zapier/webhooks', () => {
	const build = ({
		subscriptions = [{ ...INTEGRATION, id: 'subscription-1', integrationId: 'integration-1' }] as unknown[],
		findIntegrationForCurrentUser = async (_id: string): Promise<unknown> => INTEGRATION,
		resolveIntegrationFromBearerToken = async (_token: string): Promise<unknown> => INTEGRATION
	} = {}) => {
		const repository = {
			find: jest.fn().mockResolvedValue(subscriptions),
			findOne: jest.fn().mockResolvedValue({ ...INTEGRATION, id: 'subscription-1' }),
			delete: jest.fn().mockResolvedValue({ affected: 1 })
		};
		const service = new ZapierWebhookService(repository as any, {} as any);
		const zapierService = {
			findIntegrationForCurrentUser: jest.fn(findIntegrationForCurrentUser),
			resolveIntegrationFromBearerToken: jest.fn(resolveIntegrationFromBearerToken)
		};
		const controller = new ZapierWebhookController(service, zapierService as any);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		jest.spyOn((controller as any).logger, 'error').mockImplementation(() => undefined);
		return { controller, service, repository, zapierService };
	};

	afterEach(() => jest.restoreAllMocks());

	it('is served, next to the subscribe and unsubscribe routes', () => {
		const handler = ZapierWebhookController.prototype.getWebhooks;
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/webhooks');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
	});

	it('lists the subscriptions of the integration the web app names, newest first', async () => {
		const { controller, repository, zapierService } = build();

		await expect(controller.getWebhooks(' integration-1 ', 'Bearer user-session')).resolves.toEqual([
			expect.objectContaining({ id: 'subscription-1' })
		]);
		expect(zapierService.findIntegrationForCurrentUser).toHaveBeenCalledWith('integration-1');
		expect(zapierService.resolveIntegrationFromBearerToken).not.toHaveBeenCalled();
		expect(repository.find).toHaveBeenCalledWith({
			where: { integrationId: 'integration-1', tenantId: 'tenant-1', organizationId: 'organization-1' },
			order: { createdAt: 'DESC' }
		});
	});

	it('refuses a caller outside the named integration’s organization, or tenant', async () => {
		const forbidden = build({
			findIntegrationForCurrentUser: async () => {
				throw new ForbiddenException();
			}
		});
		await expect(forbidden.controller.getWebhooks('integration-1', 'Bearer x')).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(forbidden.repository.find).not.toHaveBeenCalled();

		const missing = build({
			findIntegrationForCurrentUser: async () => {
				throw new NotFoundException();
			}
		});
		await expect(missing.controller.getWebhooks('integration-of-tenant-2', 'Bearer x')).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(missing.repository.find).not.toHaveBeenCalled();
	});

	it('without an integration ID, lists the bearer token’s integration for a member of its organization', async () => {
		const { controller, repository, zapierService } = build();

		await controller.getWebhooks(undefined as any, 'Bearer zapier-token');

		expect(zapierService.resolveIntegrationFromBearerToken).toHaveBeenCalledWith('zapier-token');
		expect(zapierService.findIntegrationForCurrentUser).toHaveBeenCalledWith('integration-1');
		expect(repository.find).toHaveBeenCalled();
	});

	it('without an integration ID, refuses a missing or malformed Authorization header', async () => {
		const { controller, zapierService } = build();

		await expect(controller.getWebhooks(undefined as any, undefined as any)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		await expect(controller.getWebhooks('', 'Basic abc')).rejects.toBeInstanceOf(UnauthorizedException);
		expect(zapierService.resolveIntegrationFromBearerToken).not.toHaveBeenCalled();
	});

	it('keeps the token check’s refusal, and answers 500 for an unexpected failure', async () => {
		const rejected = build({
			resolveIntegrationFromBearerToken: async () => {
				throw new UnauthorizedException('Invalid or expired access token');
			}
		});
		await expect(rejected.controller.getWebhooks(undefined as any, 'Bearer bad')).rejects.toBeInstanceOf(
			UnauthorizedException
		);

		const failing = build();
		failing.repository.find.mockRejectedValue(new Error('connection lost'));
		await expect(failing.controller.getWebhooks('integration-1', 'Bearer x')).rejects.toBeInstanceOf(
			InternalServerErrorException
		);
	});

	it('never lists without every bound', async () => {
		const { service, repository } = build();

		await expect(
			service.findSubscriptions({
				integrationId: 'integration-1',
				tenantId: 'tenant-1',
				organizationId: undefined
			})
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.find).not.toHaveBeenCalled();
	});
});

describe('DELETE /integration/zapier/webhooks/:id with the integration the web app names', () => {
	it("deletes a subscription of the named integration's organization, without reading the bearer token", async () => {
		const repository = {
			findOne: jest.fn().mockResolvedValue({ ...INTEGRATION, id: 'subscription-1' }),
			delete: jest.fn().mockResolvedValue({ affected: 1 })
		};
		const service = new ZapierWebhookService(repository as any, {} as any);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
		const zapierService = {
			findIntegrationForCurrentUser: jest.fn(async () => INTEGRATION),
			resolveIntegrationFromBearerToken: jest.fn()
		};
		const controller = new ZapierWebhookController(service, zapierService as any);

		await expect(
			controller.deleteWebhook('subscription-1', 'Bearer user-session', 'integration-1')
		).resolves.toBeUndefined();
		expect(zapierService.findIntegrationForCurrentUser).toHaveBeenCalledWith('integration-1');
		expect(zapierService.resolveIntegrationFromBearerToken).not.toHaveBeenCalled();
		expect(repository.delete).toHaveBeenCalledWith('subscription-1');
	});

	it("refuses another organization's subscription of the tenant", async () => {
		const repository = {
			findOne: jest
				.fn()
				.mockResolvedValue({ ...INTEGRATION, id: 'subscription-1', organizationId: 'organization-2' }),
			delete: jest.fn()
		};
		const service = new ZapierWebhookService(repository as any, {} as any);
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		const zapierService = { findIntegrationForCurrentUser: jest.fn(async () => INTEGRATION) };
		const controller = new ZapierWebhookController(service, zapierService as any);

		await expect(controller.deleteWebhook('subscription-1', 'Bearer x', 'integration-1')).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(repository.delete).not.toHaveBeenCalled();
	});
});
