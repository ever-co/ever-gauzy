import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { Subject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { openPlatformEventStream } from './platform-events.resolver';
import { currentSubscriberUserId, tenantScopedEventStream, tenantScopedTopicStream } from './plugin-subscription';
import { SubscriptionCatalogue } from './subscription-catalogue';
import { GraphqlSubscriptionConsumer } from './subscription-consumer';
import { GraphqlSubscriptionHub, SubscriptionEnvelope } from './subscription-hub.service';
import {
	addressedRecipientsOf,
	isAddressedTo,
	SubscriptionAuthorizer,
	SubscriptionScopeInput,
	resolveSubscriptionScope
} from './subscription-scope';

/**
 * Addressed events (plan G-P3-6): a fact that names its recipients — an inbox item — reaches the subscriptions of
 * those users only. The tenant topic, the organization and the permission keep deciding as before; the recipient
 * check is one more narrowing, it never widens, and an event that names no recipients is not affected by it.
 */
describe('addressed events (per-recipient delivery)', () => {
	const TENANT = 'tenant-a';
	const ORG = 'organization-a';
	const ALICE = 'user-alice';
	const BOB = 'user-bob';

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

	describe('the payload convention', () => {
		it('reads `recipientUserIds` from the payload; none is "not addressed", a malformed one is "nobody"', () => {
			expect(addressedRecipientsOf({ id: 'x' })).toBeUndefined();
			expect(addressedRecipientsOf(null)).toBeUndefined();
			expect(addressedRecipientsOf('text')).toBeUndefined();
			expect(addressedRecipientsOf({ recipientUserIds: undefined })).toBeUndefined();
			expect(addressedRecipientsOf({ recipientUserIds: [ALICE, 7, null, { id: BOB }] })).toEqual([ALICE, '7']);
			expect(addressedRecipientsOf({ recipientUserIds: ALICE })).toEqual([]);
			expect(addressedRecipientsOf({ recipientUserIds: null })).toEqual([]);
		});

		it('an addressed event reaches a user only when the list names them, never a subscriber without a user', () => {
			expect(isAddressedTo([ALICE, BOB], ALICE)).toBe(true);
			expect(isAddressedTo([ALICE], BOB)).toBe(false);
			expect(isAddressedTo([], ALICE)).toBe(false);
			expect(isAddressedTo([ALICE], undefined)).toBe(false);
			expect(isAddressedTo([ALICE], null)).toBe(false);
			expect(isAddressedTo(ALICE, ALICE)).toBe(false);
		});
	});

	describe('the hub (Subscription.events)', () => {
		const authorizer = new SubscriptionAuthorizer();
		const catalogue = new SubscriptionCatalogue();
		catalogue.declare('inbox_item.created', 'widget.changed');

		const scopeOf = (overrides: Partial<SubscriptionScopeInput> = {}) =>
			resolveSubscriptionScope({
				subscriberId: `s#${Math.random()}`,
				tenantId: TENANT,
				organizationId: ORG,
				permissions: [PermissionsEnum.EVENT_OUTBOX_VIEW],
				requiredPermission: PermissionsEnum.EVENT_OUTBOX_VIEW,
				eventNames: ['inbox_item.*', 'widget.*'],
				...overrides
			});

		const event = (overrides: Partial<SubscriptionEnvelope> = {}): SubscriptionEnvelope => ({
			eventId: 'e1',
			name: 'inbox_item.created',
			occurredAt: '2026-10-17T00:00:00.000Z',
			tenantId: TENANT,
			organizationId: ORG,
			aggregate: { type: 'inbox_item', id: 'item-1' },
			data: { id: 'item-1', recipientUserIds: [ALICE] },
			recipientUserIds: [ALICE],
			...overrides
		});

		it('keeps the user of the credential on the scope', () => {
			expect(scopeOf({ recipientUserId: ` ${ALICE} ` }).recipientUserId).toBe(ALICE);
			expect(scopeOf({ recipientUserId: '' }).recipientUserId).toBeUndefined();
		});

		it('delivers an addressed event to its recipient only — not to another user holding the same grant', async () => {
			const alice = await authorizer.authorize(scopeOf({ recipientUserId: ALICE }), catalogue);
			const bob = await authorizer.authorize(scopeOf({ recipientUserId: BOB }), catalogue);
			const keyOnly = await authorizer.authorize(scopeOf({ recipientUserId: undefined }), catalogue);

			expect(await authorizer.mayDeliver(alice, event())).toBe(true);
			expect(await authorizer.mayDeliver(bob, event())).toBe(false);
			expect(await authorizer.mayDeliver(keyOnly, event())).toBe(false);
			expect(await authorizer.mayDeliver(alice, event({ recipientUserIds: [] }))).toBe(false);
		});

		it('leaves an event that names no recipients to the checks it always had', async () => {
			const bob = await authorizer.authorize(scopeOf({ recipientUserId: BOB }), catalogue);
			const unaddressed = event({ name: 'widget.changed', recipientUserIds: undefined, data: { id: 'w' } });

			expect(await authorizer.mayDeliver(bob, unaddressed)).toBe(true);
			// The recipient never widens: another tenant's addressed event stays out even for a named user.
			expect(await authorizer.mayDeliver(bob, event({ tenantId: 'tenant-b', recipientUserIds: [BOB] }))).toBe(
				false
			);
		});

		it('the outbox consumer addresses an event whose payload names recipients, and the stream obeys it', async () => {
			const pubSub = new GraphqlPubSub();
			const hub = new GraphqlSubscriptionHub(pubSub, new SubscriptionAuthorizer(), catalogue);
			const consumer = new GraphqlSubscriptionConsumer(hub, catalogue);
			const context = { assertOrder: async () => undefined, alreadyDelivered: async () => false };
			const input = (userId: string): SubscriptionScopeInput => ({
				subscriberId: `${userId}#${Math.random()}`,
				tenantId: TENANT,
				organizationId: ORG,
				credentialId: userId,
				requiredPermission: PermissionsEnum.EVENT_OUTBOX_VIEW,
				permissionEvaluator: async () => true,
				eventNames: ['inbox_item.created'],
				recipientUserId: userId
			});
			const alice = await openPlatformEventStream(hub, input(ALICE));
			const bob = await openPlatformEventStream(hub, input(BOB));

			try {
				await consumer.handle(
					{
						id: 'outbox-1',
						name: 'inbox_item.created',
						occurredAt: '2026-10-17T00:00:00.000Z',
						tenantId: TENANT,
						organizationId: ORG,
						aggregate: { type: 'inbox_item', id: 'item-1' },
						sequence: 1,
						data: { id: 'item-1', kind: 'QUESTION', recipientUserIds: [ALICE] }
					} as never,
					context as never
				);

				const delivered = await nextWithin(alice);
				expect(delivered).toMatchObject({ eventId: 'outbox-1', eventName: 'inbox_item.created' });
				// The recipient list did its work in the hub: a recipient is not handed the other recipients.
				expect((delivered as { data: unknown }).data).toEqual({ id: 'item-1', kind: 'QUESTION' });
				expect(await nextWithin(bob)).toBe('nothing');
			} finally {
				await alice.return?.();
				await bob.return?.();
				hub.onModuleDestroy();
				pubSub.onModuleDestroy();
			}
		});
	});

	describe('the plugin streams', () => {
		const originalClsService = RequestContext['clsService'];

		/** Runs work as a signed-in user of the tenant. */
		const as = <T>(userId: string | undefined, work: () => T): T =>
			RequestContext.runWithRequest(
				{ user: { id: userId, tenantId: TENANT, lastOrganizationId: ORG } } as never,
				work
			);

		beforeAll(() => {
			RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		});

		afterAll(() => {
			RequestContext['clsService'] = originalClsService;
		});

		it('captures the user of the operation, and none outside one', () => {
			expect(as(ALICE, () => currentSubscriberUserId())).toBe(ALICE);
			expect(currentSubscriberUserId()).toBeNull();
		});

		it("a tenant topic delivers an envelope addressed to its recipients only (the envelope's own list)", async () => {
			const pubSub = new GraphqlPubSub();
			const alice = as(ALICE, () => tenantScopedTopicStream(pubSub, 'inbox_item.created'));
			const bob = as(BOB, () => tenantScopedTopicStream(pubSub, 'inbox_item.created'));

			try {
				await pubSub.publish('inbox_item.created', TENANT, {
					name: 'inbox_item.created',
					tenantId: TENANT,
					id: 'for-alice',
					recipientUserIds: [ALICE]
				});
				await pubSub.publish('inbox_item.created', TENANT, {
					name: 'inbox_item.created',
					tenantId: TENANT,
					id: 'malformed',
					recipientUserIds: BOB
				});
				// Not addressed: delivered to both, as before.
				await pubSub.publish('inbox_item.created', TENANT, {
					name: 'inbox_item.created',
					tenantId: TENANT,
					id: 'everyone'
				});

				expect(await nextWithin(alice)).toMatchObject({ id: 'for-alice' });
				expect(await nextWithin(alice)).toMatchObject({ id: 'everyone' });
				expect(await nextWithin(bob)).toMatchObject({ id: 'everyone' });
				expect(await nextWithin(bob)).toBe('nothing');
			} finally {
				await alice.return?.();
				await bob.return?.();
				pubSub.onModuleDestroy();
			}
		});

		it('an in-process stream applies the recipients only when the stream names them (`recipientsOf`)', async () => {
			const source = new Subject<{ tenantId: string; id: string; to: string[] }>();
			const addressed = as(BOB, () =>
				tenantScopedEventStream(source, {
					tenantOf: (event) => event.tenantId,
					recipientsOf: (event) => event.to
				})
			);
			const plain = as(BOB, () => tenantScopedEventStream(source, { tenantOf: (event) => event.tenantId }));

			try {
				source.next({ tenantId: TENANT, id: 'for-alice', to: [ALICE] });
				source.next({ tenantId: TENANT, id: 'for-bob', to: [BOB] });

				expect(await nextWithin(addressed)).toMatchObject({ id: 'for-bob' });
				expect(await nextWithin(addressed)).toBe('nothing');
				expect(await nextWithin(plain)).toMatchObject({ id: 'for-alice' });
			} finally {
				await addressed.return?.();
				await plain.return?.();
			}
		});
	});
});
