import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { ClsService } from 'nestjs-cls';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { ApiException } from '../../core/errors/api-exception';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { deliverPayloadAsIs } from './plugin-subscription';
import {
	IPlatformEventEnvelope,
	PlatformEventsResolver,
	openPlatformEventStream,
	rolePermissionEvaluator,
	toPlatformEventEnvelope
} from './platform-events.resolver';
import { SubscriptionCatalogue } from './subscription-catalogue';
import { GraphqlSubscriptionConsumer } from './subscription-consumer';
import { GraphqlSubscriptionHub, SubscriptionEnvelope } from './subscription-hub.service';
import { SubscriptionAuthorizer, SubscriptionScopeInput } from './subscription-scope';

/**
 * `Subscription.events` — the kernel's own stream — over the subscription hub.
 *
 * The field was declared and bound to nothing, so a client that subscribed was answered nothing at all.
 * These cases run the real hub, fan-out, catalogue and authorizer, and the real outbox consumer that feeds
 * a declared plugin event to the hub, so what is asserted is what a subscriber receives.
 */
describe('Subscription.events', () => {
	const TENANT_A = 'tenant-a';
	const TENANT_B = 'tenant-b';
	const ORG_A = 'organization-a';

	let pubSub: GraphqlPubSub;
	let catalogue: SubscriptionCatalogue;
	let hub: GraphqlSubscriptionHub;

	/** A catalogued event of one tenant, as the outbox consumer and the core publishers hand it to the hub. */
	const envelope = (tenantId: string, overrides: Partial<SubscriptionEnvelope> = {}): SubscriptionEnvelope => ({
		eventId: `event-of-${tenantId}`,
		name: 'widget.changed',
		occurredAt: '2026-10-09T10:00:00.000Z',
		tenantId,
		aggregate: { type: 'Widget', id: `widget-of-${tenantId}` },
		sequence: 7,
		data: { id: `widget-of-${tenantId}` },
		...overrides
	});

	/** What a subscriber of tenant A asks for. */
	const input = (overrides: Partial<SubscriptionScopeInput> = {}): SubscriptionScopeInput => ({
		subscriberId: `subscriber#${Math.random()}`,
		tenantId: TENANT_A,
		organizationId: ORG_A,
		credentialKind: 'jwt',
		credentialId: 'user-a',
		requiredPermission: PermissionsEnum.EVENT_OUTBOX_VIEW,
		permissionEvaluator: async () => true,
		eventNames: ['widget.*'],
		...overrides
	});

	/** Pulls the next value, or answers `'nothing'` when none arrives in time. */
	const nextWithin = async <T>(iterator: AsyncIterator<T>, ms = 120): Promise<T | 'nothing' | 'done'> => {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<'nothing'>((resolve) => (timer = setTimeout(() => resolve('nothing'), ms)));
		const result = await Promise.race([
			iterator.next().then((r) => (r.done ? ('done' as const) : r.value)),
			timeout
		]);
		clearTimeout(timer);
		return result;
	};

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		catalogue = new SubscriptionCatalogue();
		catalogue.declare('widget.changed', 'widget.deleted');
		hub = new GraphqlSubscriptionHub(pubSub, new SubscriptionAuthorizer(), catalogue);
	});

	afterEach(() => {
		hub.onModuleDestroy();
		pubSub.onModuleDestroy();
	});

	it("delivers a subscriber its own tenant's events, one envelope per event, and nothing of another tenant's", async () => {
		const stream = await openPlatformEventStream(hub, input());

		await hub.publish(envelope(TENANT_B));
		await hub.publish(envelope(TENANT_A));

		expect(await nextWithin(stream)).toEqual<IPlatformEventEnvelope>({
			eventId: 'event-of-tenant-a',
			eventName: 'widget.changed',
			occurredAt: '2026-10-09T10:00:00.000Z',
			aggregate: { type: 'Widget', id: 'widget-of-tenant-a' },
			sequence: 7,
			data: { id: 'widget-of-tenant-a' }
		});
		expect(await nextWithin(stream)).toBe('nothing');

		await stream.return?.();
	});

	it('carries a declared plugin event appended to the outbox to the subscriber of its tenant', async () => {
		const consumer = new GraphqlSubscriptionConsumer(hub, catalogue);
		const stream = await openPlatformEventStream(hub, input({ eventNames: ['widget.deleted'] }));
		const context = { assertOrder: async () => undefined, alreadyDelivered: async () => false };

		for (const tenantId of [TENANT_B, TENANT_A]) {
			await consumer.handle(
				{
					id: `outbox-${tenantId}`,
					name: 'widget.deleted',
					occurredAt: '2026-10-09T10:00:00.000Z',
					tenantId,
					organizationId: ORG_A,
					aggregate: { type: 'Widget', id: `widget-of-${tenantId}` },
					sequence: 1,
					data: { reason: 'retired' }
				} as never,
				context as never
			);
		}

		expect(await nextWithin(stream)).toMatchObject({ eventId: 'outbox-tenant-a', eventName: 'widget.deleted' });
		expect(await nextWithin(stream)).toBe('nothing');
		expect(consumer.events).toEqual(['widget.changed', 'widget.deleted']);

		await stream.return?.();
	});

	it('answers an organization-less subscriber only the tenant-wide events, as its REST twin does', async () => {
		const stream = await openPlatformEventStream(hub, input({ organizationId: undefined }));

		await hub.publish(envelope(TENANT_A, { eventId: 'of-an-organization', organizationId: ORG_A }));
		await hub.publish(envelope(TENANT_A, { eventId: 'tenant-wide' }));

		expect(await nextWithin(stream)).toMatchObject({ eventId: 'tenant-wide' });
		expect(await nextWithin(stream)).toBe('nothing');

		await stream.return?.();
	});

	it('refuses a selection that matches no catalogued event, rather than opening a silent stream', async () => {
		await expect(openPlatformEventStream(hub, input({ eventNames: ['order.placed'] }))).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('refuses a credential the live permission check says no to', async () => {
		const refusal = await openPlatformEventStream(hub, input({ permissionEvaluator: async () => false })).catch(
			(error) => error
		);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe('PERMISSION_DENIED');
		expect(refusal.getStatus()).toBe(403);
	});

	it('stops delivering when the permission is revoked while the stream is open', async () => {
		let allowed = true;
		const stream = await openPlatformEventStream(hub, input({ permissionEvaluator: async () => allowed }));

		allowed = false;
		await hub.publish(envelope(TENANT_A));

		expect(await nextWithin(stream)).toBe('nothing');
		await stream.return?.();
	});

	it('closes the hub subscription and its topics when the client completes', async () => {
		const stream = await openPlatformEventStream(hub, input());
		expect(hub.subscriptions).toHaveLength(1);
		expect(pubSub.openStreams).toBe(2);

		const pending = stream.next();
		await stream.return?.();

		await expect(pending).resolves.toEqual({ value: undefined, done: true });
		expect(hub.subscriptions).toHaveLength(0);
		await new Promise((resolve) => setImmediate(resolve));
		expect(pubSub.openStreams).toBe(0);
	});

	describe('the envelope a subscriber receives', () => {
		const scope = { tenantId: TENANT_A, organizationId: ORG_A };

		it('is withheld when it cannot fill the schema’s non-null members', () => {
			expect(toPlatformEventEnvelope(envelope(TENANT_A, { aggregate: undefined }), scope)).toBeUndefined();
			expect(toPlatformEventEnvelope(envelope(TENANT_A, { eventId: '' }), scope)).toBeUndefined();
			expect(toPlatformEventEnvelope(undefined, scope)).toBeUndefined();
		});

		it("is withheld when it is another tenant's", () => {
			expect(toPlatformEventEnvelope(envelope(TENANT_B), scope)).toBeUndefined();
		});

		it('serves a sequence past the schema’s Int as null rather than truncating it', () => {
			expect(toPlatformEventEnvelope(envelope(TENANT_A, { sequence: 2 ** 40 }), scope)?.sequence).toBeNull();
			expect(toPlatformEventEnvelope(envelope(TENANT_A, { data: undefined }), scope)?.data).toEqual({});
		});
	});

	describe('the resolver', () => {
		const originalClsService = RequestContext['clsService'];

		beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
		afterAll(() => {
			RequestContext['clsService'] = originalClsService;
		});

		it('states the outbox listing’s grant, and delivers the envelope as the payload', () => {
			const handler = PlatformEventsResolver.prototype.events;

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([PermissionsEnum.EVENT_OUTBOX_VIEW]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)?.resolve).toBe(deliverPayloadAsIs);
		});

		it('refuses an operation with no tenant', async () => {
			const resolver = new PlatformEventsResolver(hub, { checkRolePermission: jest.fn() } as never);

			await expect(resolver.events(['widget.*'])).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it("scopes the stream from the credential and asks the subscriber's role, never an argument", async () => {
			const roles = { checkRolePermission: jest.fn(async () => true) };
			const resolver = new PlatformEventsResolver(hub, roles as never);

			const stream = await RequestContext.runWithRequest(
				{
					user: { id: 'user-a', tenantId: TENANT_A, lastOrganizationId: ORG_A, roleId: 'role-a' },
					headers: {}
				} as never,
				() => resolver.events(['widget.*'])
			);

			expect(hub.subscriptions).toEqual([
				expect.objectContaining({ tenantId: TENANT_A, eventNames: ['widget.changed', 'widget.deleted'] })
			]);
			expect(roles.checkRolePermission).toHaveBeenCalledWith(
				TENANT_A,
				'role-a',
				[PermissionsEnum.EVENT_OUTBOX_VIEW],
				true
			);

			await hub.publish(envelope(TENANT_B));
			await hub.publish(envelope(TENANT_A, { organizationId: ORG_A }));
			expect(await nextWithin(stream)).toMatchObject({ eventId: 'event-of-tenant-a' });
			expect(await nextWithin(stream)).toBe('nothing');

			await stream.return?.();
		});
	});

	describe('the live permission question', () => {
		it('asks the role once a minute rather than once an event', async () => {
			const roles = { checkRolePermission: jest.fn(async () => true) };
			const ask = rolePermissionEvaluator(roles, TENANT_A, 'role-a');

			await expect(ask(PermissionsEnum.EVENT_OUTBOX_VIEW)).resolves.toBe(true);
			await expect(ask(PermissionsEnum.EVENT_OUTBOX_VIEW)).resolves.toBe(true);
			expect(roles.checkRolePermission).toHaveBeenCalledTimes(1);
		});

		it('answers no without a role, and no when the role check fails', async () => {
			const failing = { checkRolePermission: jest.fn(async () => Promise.reject(new Error('database down'))) };

			await expect(
				rolePermissionEvaluator(failing, TENANT_A, undefined)(PermissionsEnum.EVENT_OUTBOX_VIEW)
			).resolves.toBe(false);
			await expect(
				rolePermissionEvaluator(failing, TENANT_A, 'role-a')(PermissionsEnum.EVENT_OUTBOX_VIEW)
			).resolves.toBe(false);
		});
	});
});
