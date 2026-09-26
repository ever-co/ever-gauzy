/**
 * The webhook resources over REST (API specification §7.21, §2, §4).
 *
 * The suite pins the four things a controller owes and a service cannot state for it:
 *
 * - **the route table** — the paths and methods the design names, read from the route metadata Nest
 *   itself dispatches on, so a route that quietly stopped existing is caught rather than described.
 *   The set is asserted whole rather than one route at a time, which is what makes "no route serves
 *   the secret a second time" a statement about the surface instead of about one handler;
 * - **the guard chain** — both protocol guards are on both classes, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion
 *   is about the decision and not about the decorator's prose. The redelivery carries the retry
 *   permission rather than the edit one its neighbours carry, which is the catalogue's split and not
 *   an accident of this class;
 * - **the projection** — every answer is the service's own: a read hands back what the service
 *   redacted, and the create and the rotation are the only two routes through which a plaintext
 *   secret travels.
 *
 * Three module boundaries are doubled, and the reason is the same for all three: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside. A fourth is
 * doubled for a load-order reason: the guards barrel reaches the employee repository and, through it,
 * the entity graph from the wrong end.
 *
 * **The controllers under test are the real ones**, over scripted services, so a route that stopped
 * delegating — or delegated to something else — is caught here rather than accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: a resolver carries the feature guard its module's resolvers
	// are declared under, and a spec that doubles the guard barrel has to double that one too.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('../core/crud/crud.service', () => {
	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return { CrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => ({ id: 'user-1', tenantId: '00000000-0000-4000-8000-000000000001' }),
		currentUserId: () => 'user-1',
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		currentRoleId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * the note in the suite above: an entity decorator applied before its validator module has finished
 * evaluating fails the LOAD rather than an assertion, and the API never hits it because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../core/entities/internal';

import { HttpException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum, WebhookDeliveryStatus } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookSubscriptionController } from './webhook-subscription.controller';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000010';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000020';
const DELIVERY = '00000000-0000-4000-8000-000000000030';
const EVENT = '00000000-0000-4000-8000-000000000040';

/** The plaintext secret as the two generating operations answer with it. */
const SECRET = 'whsec_test_fixture_2f8c1d9a4b6e8f0a1c3d5e7f9a2b4c6d';

/** The subscription projection a scripted service answers with: no secret, a fingerprint instead. */
const SUBSCRIPTION_ROW = {
	id: SUBSCRIPTION,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	name: 'Order notifications',
	url: 'https://receiver.example.test/hooks/orders',
	events: ['order.placed'],
	channelId: CHANNEL,
	apiVersion: '1',
	failureCount: 0,
	isActive: true,
	secretFingerprint: '6f1c2a9d'
};

/** The delivery projection a scripted service answers with. */
const DELIVERY_ROW = {
	id: DELIVERY,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	subscriptionId: SUBSCRIPTION,
	eventId: EVENT,
	eventName: 'order.placed',
	status: WebhookDeliveryStatus.FAILED,
	attemptCount: 3,
	responseStatus: 500,
	durationMs: 412,
	lastError: 'The endpoint answered 500.',
	lastAttempt: { id: `${DELIVERY}.3`, deliveryId: DELIVERY, attempt: 3, delivered: false }
};

/**
 * The two services, scripted per route.
 *
 * Every member the controllers reach is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const webhookSubscriptionService = {
		listSubscriptions: jest.fn().mockResolvedValue([SUBSCRIPTION_ROW]),
		getRedactedSubscription: jest.fn().mockResolvedValue(SUBSCRIPTION_ROW),
		createSubscription: jest.fn().mockResolvedValue({ subscription: SUBSCRIPTION_ROW, secret: SECRET }),
		updateSubscription: jest.fn().mockResolvedValue(SUBSCRIPTION_ROW),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		rotateSecret: jest.fn().mockResolvedValue({
			subscription: SUBSCRIPTION_ROW,
			secret: SECRET,
			previousSecretValidUntil: '2026-03-04T10:00:00.000Z'
		}),
		enable: jest.fn().mockResolvedValue({ ...SUBSCRIPTION_ROW, disabledAt: null }),
		disable: jest.fn().mockResolvedValue({ ...SUBSCRIPTION_ROW, isActive: false }),
		...overrides
	};
	const webhookDeliveryService = {
		listDeliveries: jest.fn().mockResolvedValue([DELIVERY_ROW]),
		getRedactedDelivery: jest.fn().mockResolvedValue(DELIVERY_ROW),
		requeue: jest.fn().mockResolvedValue({ ...DELIVERY_ROW, status: WebhookDeliveryStatus.PENDING }),
		redact: jest.fn((row: Record<string, unknown>) => row),
		...overrides
	};

	return {
		webhookSubscriptionService,
		webhookDeliveryService,
		subscriptions: new WebhookSubscriptionController(webhookSubscriptionService as never),
		deliveries: new WebhookDeliveryController(webhookDeliveryService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/**
 * The route table of one controller, as Nest itself dispatches it.
 *
 * The path and the method are read from the metadata the framework's router reads, so this is the
 * surface that exists rather than a list of the handlers somebody meant to declare.
 */
function routesOf(
	controller: typeof WebhookSubscriptionController | typeof WebhookDeliveryController
): Array<{ handler: string; method: RequestMethod; path: string }> {
	return Object.getOwnPropertyNames(controller.prototype)
		.filter((name) => name !== 'constructor')
		.map((name) => ({
			handler: name,
			method: Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) as RequestMethod,
			path: Reflect.getMetadata(PATH_METADATA, controller.prototype[name]) as string
		}))
		.filter((route) => route.path !== undefined)
		.map((route) => ({ ...route, path: route.path === '/' ? '' : route.path }));
}

describe('WebhookSubscriptionController — the routes (API specification §7.21)', () => {
	it('is mounted where the design names it, on the resource the design names', () => {
		expect(Reflect.getMetadata(PATH_METADATA, WebhookSubscriptionController)).toBe('/webhooks/subscriptions');
		expect(Reflect.getMetadata(PATH_METADATA, WebhookDeliveryController)).toBe('/webhooks/deliveries');
	});

	it('serves exactly the subscription routes the design names, and no others', () => {
		// The whole set rather than one route at a time: a resource is a surface, and a route that was
		// never named here — a second way to read a secret, a withdrawal this domain has no notion of —
		// would be a capability the design does not have.
		expect(
			routesOf(WebhookSubscriptionController)
				.map((route) => `${RequestMethod[route.method]} ${route.path}`)
				.sort()
		).toEqual(
			[
				'DELETE :id',
				'GET ',
				'GET :id',
				'POST ',
				'POST :id/disable',
				'POST :id/enable',
				'POST :id/rotate-secret',
				'PUT :id'
			].sort()
		);
	});

	it('serves exactly the delivery routes the design names, and no others', () => {
		expect(
			routesOf(WebhookDeliveryController)
				.map((route) => `${RequestMethod[route.method]} ${route.path}`)
				.sort()
		).toEqual(['GET ', 'GET :id', 'POST :id/redeliver'].sort());
	});

	it('lists the subscriptions of the caller’s organization, and pages them', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.findAll({ isActive: true, take: 10, skip: 0 });

		// The narrowing reaches the read rather than being applied to its answer, and the page is the
		// platform's own envelope.
		expect(webhookSubscriptionService.listSubscriptions).toHaveBeenCalledWith({ isActive: true });
		expect(answer).toEqual({ items: [SUBSCRIPTION_ROW], total: 1 });
	});

	it('accepts both spellings of the list narrowing, and lets the bracketed one win', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		await subscriptions.findAll({ channelId: CHANNEL });
		expect(webhookSubscriptionService.listSubscriptions).toHaveBeenLastCalledWith({ channelId: CHANNEL });

		// The endpoint table writes its examples in the bracketed form, so that spelling is the one the
		// specification fixes — member by member, which is what makes the two spellings composable: the
		// bracketed `isActive` wins while the flat `channelId` still supplies what it does not state.
		await subscriptions.findAll({ isActive: true, channelId: CHANNEL, filter: { isActive: false } });
		expect(webhookSubscriptionService.listSubscriptions).toHaveBeenLastCalledWith({
			isActive: false,
			channelId: CHANNEL
		});

		// And the bracketed spelling stands alone when it is the only one stated.
		await subscriptions.findAll({ filter: { channelId: CHANNEL } });
		expect(webhookSubscriptionService.listSubscriptions).toHaveBeenLastCalledWith({ channelId: CHANNEL });
	});

	it('reads one subscription through the projection the service produces', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.findById(SUBSCRIPTION);

		// The node read goes through the service's own redaction rather than through the raw row, which
		// is what keeps the encrypted secret out of every answer.
		expect(webhookSubscriptionService.getRedactedSubscription).toHaveBeenCalledWith(SUBSCRIPTION);
		expect(answer).toBe(SUBSCRIPTION_ROW);
		expect(answer).not.toHaveProperty('secret');
	});

	it('subscribes an endpoint and answers the secret exactly once', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.create({
			name: 'Order notifications',
			url: 'https://receiver.example.test/hooks/orders',
			events: ['order.placed'],
			channelId: CHANNEL
		} as never);

		expect(webhookSubscriptionService.createSubscription).toHaveBeenCalledWith({
			name: 'Order notifications',
			url: 'https://receiver.example.test/hooks/orders',
			events: ['order.placed'],
			channelId: CHANNEL
		});
		expect(answer.secret).toBe(SECRET);
		expect(answer.subscription).not.toHaveProperty('secret');
		expect(answer.subscription.secretFingerprint).toBe('6f1c2a9d');
	});

	it('changes a subscription, carrying the path identifier beside the body', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.update(SUBSCRIPTION, { name: 'Renamed' } as never);

		expect(webhookSubscriptionService.updateSubscription).toHaveBeenCalledWith(SUBSCRIPTION, {
			name: 'Renamed'
		});
		expect(answer).toBe(SUBSCRIPTION_ROW);
	});

	it('removes a subscription and answers the store’s own delete result', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.delete(SUBSCRIPTION);

		expect(webhookSubscriptionService.delete).toHaveBeenCalledWith(SUBSCRIPTION);
		// The route answers what the removal was: a statement about the write rather than a row.
		expect(answer).toEqual({ affected: 1 });
	});

	it('rotates the signing secret and answers the grace window beside it', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const answer = await subscriptions.rotateSecret(SUBSCRIPTION);

		expect(webhookSubscriptionService.rotateSecret).toHaveBeenCalledWith(SUBSCRIPTION);
		expect(answer.secret).toBe(SECRET);
		expect(answer.previousSecretValidUntil).toBe('2026-03-04T10:00:00.000Z');
	});

	it('switches an endpoint off with a reason and back on without one', async () => {
		const { subscriptions, webhookSubscriptionService } = surfaces();

		const disabled = await subscriptions.disable(SUBSCRIPTION, { reason: 'Receiver being migrated.' });

		expect(webhookSubscriptionService.disable).toHaveBeenCalledWith(SUBSCRIPTION, 'Receiver being migrated.');
		expect(disabled.isActive).toBe(false);

		// A switch thrown with no body states no reason, which is a different request from one that
		// states an empty string — and the service is what records either.
		await subscriptions.disable(SUBSCRIPTION, undefined);
		expect(webhookSubscriptionService.disable).toHaveBeenLastCalledWith(SUBSCRIPTION, undefined);

		const enabled = await subscriptions.enable(SUBSCRIPTION);

		expect(webhookSubscriptionService.enable).toHaveBeenCalledWith(SUBSCRIPTION);
		expect(enabled.disabledAt).toBeNull();
	});
});

describe('WebhookDeliveryController — the routes (API specification §7.21)', () => {
	it('lists the delivery log of the caller’s organization', async () => {
		const { deliveries, webhookDeliveryService } = surfaces();

		const answer = await deliveries.findAll({ status: WebhookDeliveryStatus.FAILED, take: 20 });

		expect(webhookDeliveryService.listDeliveries).toHaveBeenCalledWith({ status: WebhookDeliveryStatus.FAILED });
		// The answer is the service's own projection, which carries no stored body.
		expect(answer.items[0]).toBe(DELIVERY_ROW);
		expect(answer.items[0]).not.toHaveProperty('payload');
		expect(answer.total).toBe(1);
	});

	it('accepts the bracketed spelling of the delivery narrowing too', async () => {
		const { deliveries, webhookDeliveryService } = surfaces();

		await deliveries.findAll({ filter: { subscriptionId: SUBSCRIPTION, eventName: 'order.placed' } });

		expect(webhookDeliveryService.listDeliveries).toHaveBeenCalledWith({
			subscriptionId: SUBSCRIPTION,
			eventName: 'order.placed'
		});
	});

	it('reads one delivery through the projection, for triage', async () => {
		const { deliveries, webhookDeliveryService } = surfaces();

		const answer = await deliveries.findById(DELIVERY);

		expect(webhookDeliveryService.getRedactedDelivery).toHaveBeenCalledWith(DELIVERY);
		// What an operator triages with is on the answer: the status the endpoint gave, how long the
		// attempt took, and the error. What was sent is not.
		expect(answer).toBe(DELIVERY_ROW);
		expect(answer.responseStatus).toBe(500);
		expect(answer.durationMs).toBe(412);
		expect(answer.lastAttempt).toEqual(expect.objectContaining({ attempt: 3 }));
		expect(answer).not.toHaveProperty('payload');
	});

	it('requeues one delivery and answers the requeued row through the projection', async () => {
		const { deliveries, webhookDeliveryService } = surfaces();

		const answer = await deliveries.redeliver(DELIVERY);

		expect(webhookDeliveryService.requeue).toHaveBeenCalledWith(DELIVERY);
		// The route makes no request of its own: it puts the row back in the queue, and the retry worker
		// is what calls the endpoint. The projection is applied to the row it answers with.
		expect(webhookDeliveryService.redact).toHaveBeenCalledWith(
			expect.objectContaining({ status: WebhookDeliveryStatus.PENDING })
		);
		expect(answer.status).toBe(WebhookDeliveryStatus.PENDING);
	});
});

describe('WebhookSubscriptionController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a duplicate endpoint with the catalogue’s own conflict', async () => {
		const refusal = new HttpException('UNIQUE_CONSTRAINT_VIOLATION: this endpoint is already subscribed.', 409);
		const { subscriptions } = surfaces({ createSubscription: jest.fn().mockRejectedValue(refusal) });

		const error = await subscriptions
			.create({ name: 'x', url: 'https://receiver.example.test/hooks', events: ['*'] } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(409);
		expect((error as Error).message).toContain('UNIQUE_CONSTRAINT_VIOLATION');
	});

	it('refuses an endpoint the platform must not call, with the code the catalogue names', async () => {
		const refusal = new HttpException('WEBHOOK_URL_NOT_ALLOWED: a webhook endpoint must use HTTPS.', 400);
		const { subscriptions } = surfaces({ createSubscription: jest.fn().mockRejectedValue(refusal) });

		const error = await subscriptions
			.create({ name: 'x', url: 'http://receiver.example.test/hooks', events: ['*'] } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('WEBHOOK_URL_NOT_ALLOWED');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { subscriptions, deliveries } = surfaces();

		const onSubscriptions = await subscriptions.findAll({ take: 500 }).catch((thrown) => thrown);
		const onDeliveries = await deliveries.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(onSubscriptions)).toBe(true);
		expect((onSubscriptions as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
		expect(isRefusal(onDeliveries)).toBe(true);
		expect((onDeliveries as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('WebhookSubscriptionController — the guard stack and the permission every route declares', () => {
	it('guards both resources with both protocol guards', () => {
		for (const controller of [WebhookSubscriptionController, WebhookDeliveryController]) {
			const guards = Reflect.getMetadata('__guards__', controller) ?? [];

			expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		}
	});

	it('carries the read permission on the class of both resources', () => {
		// The class-level permission is what a route that states none of its own runs under, which is
		// why both classes state the read one rather than the edit one: a caller that may not read a
		// delivery log must not reach a route of it by the absence of a decorator.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController)).toEqual([
			PermissionsEnum.WEBHOOKS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookDeliveryController)).toEqual([
			PermissionsEnum.WEBHOOKS_VIEW
		]);
	});

	it('gives every subscription route the permission the endpoint table names', () => {
		const proto = WebhookSubscriptionController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.WEBHOOKS_VIEW],
			['findById', PermissionsEnum.WEBHOOKS_VIEW],
			['create', PermissionsEnum.WEBHOOKS_CREATE],
			['update', PermissionsEnum.WEBHOOKS_EDIT],
			['delete', PermissionsEnum.WEBHOOKS_DELETE],
			['rotateSecret', PermissionsEnum.WEBHOOKS_EDIT],
			['enable', PermissionsEnum.WEBHOOKS_EDIT],
			['disable', PermissionsEnum.WEBHOOKS_EDIT]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('gives every delivery route the permission the endpoint table names', () => {
		const proto = WebhookDeliveryController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.WEBHOOKS_VIEW],
			['findById', PermissionsEnum.WEBHOOKS_VIEW],
			// Requeueing a delivery is not a configuration change, and the catalogue gives it a
			// permission of its own: watching a log and re-firing it are separable decisions.
			['redeliver', PermissionsEnum.WEBHOOK_DELIVERIES_RETRY]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// This is the "no credential" case at the level a unit test can observe it: the guard chain is
		// what refuses a caller that presents no usable credential, and the metadata below is what
		// `PermissionGuard` reads. A write route that carried the read permission — or none — would be
		// reachable by every caller that may look at a webhook subscription.
		const subscriptionWrites = ['create', 'update', 'delete', 'rotateSecret', 'enable', 'disable'];

		for (const route of subscriptionWrites) {
			const stated =
				(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController.prototype[route]) as
					| PermissionsEnum[]
					| undefined) ?? [];

			expect(stated).not.toContain(PermissionsEnum.WEBHOOKS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}

		const redelivery = Reflect.getMetadata(
			PERMISSIONS_METADATA,
			WebhookDeliveryController.prototype.redeliver
		) as PermissionsEnum[];

		expect(redelivery).not.toContain(PermissionsEnum.WEBHOOKS_VIEW);
		expect(redelivery).toEqual([PermissionsEnum.WEBHOOK_DELIVERIES_RETRY]);
	});

	it('states every permission it uses in the platform catalogue', () => {
		// A guard is only as good as the grant behind it: a value no catalogue row carries is granted
		// to no role and refused to every caller, with a green build and a clean boot. The values this
		// resource uses are the webhook quartet the catalogue declares, read here off the source of
		// truth rather than restated.
		const used = new Set<string>([
			...(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController) ?? []),
			...(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookDeliveryController) ?? []),
			...Object.getOwnPropertyNames(WebhookSubscriptionController.prototype).flatMap(
				(name) =>
					(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController.prototype[name]) as
						| string[]
						| undefined) ?? []
			),
			...Object.getOwnPropertyNames(WebhookDeliveryController.prototype).flatMap(
				(name) =>
					(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookDeliveryController.prototype[name]) as
						| string[]
						| undefined) ?? []
			)
		]);

		expect([...used].sort()).toEqual(
			[
				PermissionsEnum.WEBHOOKS_VIEW,
				PermissionsEnum.WEBHOOKS_CREATE,
				PermissionsEnum.WEBHOOKS_EDIT,
				PermissionsEnum.WEBHOOKS_DELETE,
				PermissionsEnum.WEBHOOK_DELIVERIES_RETRY
			].sort()
		);
	});
});
