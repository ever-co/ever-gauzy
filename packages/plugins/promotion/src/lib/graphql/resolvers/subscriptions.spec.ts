/**
 * The promotion package's four subscription streams, held to the subscriber's tenant.
 *
 * `couponRedeemed`, `giftCardRedeemed`, `promotionChanged` and `promotionBudgetExhausted` read the
 * in-process bus and narrowed on the ids their arguments named and on nothing else, so a subscriber
 * holding the view grant was handed every redemption any tenant made — gift-card amounts, balances and
 * order ids included. The cases below open each stream as a user of tenant A and publish as a user of
 * tenant B — the way a mutation of another tenant reaches the bus in the running API, inside that
 * tenant's request — and assert that the subscriber hears its own tenant's event and nothing of the
 * other's.
 *
 * **Nothing is doubled but the services**, which these streams never call: the resolvers, the bus, the
 * kernel's stream and `RequestContext` over a real CLS store are the real ones, so the request the bus
 * calls back in is the publisher's, exactly as it is in production.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { deliverPayloadAsIs, EventBus, RequestContext } from '@gauzy/core';
import {
	CouponRedeemedEvent,
	GiftCardRedeemedEvent,
	PromotionBudgetExhaustedEvent,
	PromotionChangedEvent
} from '../../events/promotion.events';
import { CampaignBudgetResolver } from './campaign-budget.resolver';
import { CouponResolver } from './coupon.resolver';
import { GiftCardResolver } from './gift-card.resolver';
import { PromotionResolver } from './promotion.resolver';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_B = 'organization-b';

/** Runs work as a signed-in user of one tenant and organization. */
const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
	RequestContext.runWithRequest(
		{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
		work
	);

/**
 * Opens a stream the way graphql-js does: the field is resolved as the subscriber, and the iterator is
 * taken from it at once — before any event is published.
 */
const subscribe = (tenantId: string, organizationId: string, open: () => unknown): AsyncIterator<unknown> =>
	as(tenantId, organizationId, () => (open() as AsyncIterable<unknown>)[Symbol.asyncIterator]());

/** Everything an opened stream delivers until it has been quiet for a moment. */
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<unknown[]> => {
	const values: unknown[] = [];

	for (;;) {
		let timer: NodeJS.Timeout | undefined;
		const quiet = new Promise<'quiet'>((resolve) => (timer = setTimeout(() => resolve('quiet'), quietMs)));
		const next = await Promise.race([iterator.next(), quiet]);
		clearTimeout(timer);

		if (next === 'quiet' || next.done) {
			break;
		}

		values.push(next.value);
	}

	await iterator.return?.();
	return values;
};

describe('the promotion subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let bus: EventBus;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		bus = new EventBus();
	});

	const coupon = (tenantId: string, organizationId: string, id: string) =>
		CouponRedeemedEvent.from(
			{ id, code: 'SUMMER', currency: 'EUR', tenantId, organizationId } as never,
			'5.00',
			'order-1'
		);
	const giftCard = (tenantId: string, organizationId: string, id: string) =>
		GiftCardRedeemedEvent.from({ id, tenantId, organizationId } as never, '25.00', '75.00', 'order-1');
	const promotion = (tenantId: string, organizationId: string, id: string) =>
		PromotionChangedEvent.from({ id, status: 'ACTIVE', tenantId, organizationId } as never);
	const budget = (tenantId: string, organizationId: string, id: string) =>
		new PromotionBudgetExhaustedEvent(id, `budget-of-${id}`, '100.00', '100.00', organizationId, tenantId);

	const streams = [
		{
			field: 'couponRedeemed',
			resolver: () => new CouponResolver({} as never, {} as never, {} as never, bus),
			open: (resolver: CouponResolver, id?: string) => resolver.couponRedeemed(id),
			event: coupon
		},
		{
			field: 'giftCardRedeemed',
			resolver: () => new GiftCardResolver({} as never, {} as never, {} as never, bus),
			open: (resolver: GiftCardResolver, id?: string) => resolver.giftCardRedeemed(id),
			event: giftCard
		},
		{
			field: 'promotionChanged',
			resolver: () => new PromotionResolver({} as never, {} as never, {} as never, {} as never, {} as never, bus),
			open: (resolver: PromotionResolver, id?: string) => resolver.promotionChanged(id),
			event: promotion
		},
		{
			field: 'promotionBudgetExhausted',
			resolver: () => new CampaignBudgetResolver({} as never, {} as never, {} as never, bus),
			open: (resolver: CampaignBudgetResolver, id?: string) => resolver.promotionBudgetExhausted(id),
			event: budget
		}
	] as const;

	describe.each(streams)('$field', ({ field, resolver, open, event }) => {
		it("delivers a subscriber its own tenant's event and nothing of another tenant's", async () => {
			const subject = resolver();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const stream = subscribe(TENANT_A, ORG_A, () => (open as any)(subject));

			const theirs = event(TENANT_B, ORG_B, 'item-b');
			const ours = event(TENANT_A, ORG_A, 'item-a');
			await as(TENANT_B, ORG_B, () => bus.publish(theirs));
			await as(TENANT_A, ORG_A, () => bus.publish(ours));

			expect(await delivered(stream)).toEqual([ours]);
		});

		it("still delivers nothing of another tenant's when the subscriber names that tenant's item", async () => {
			const subject = resolver();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const stream = subscribe(TENANT_A, ORG_A, () => (open as any)(subject, 'item-b'));

			await as(TENANT_B, ORG_B, () => bus.publish(event(TENANT_B, ORG_B, 'item-b')));

			expect(await delivered(stream)).toEqual([]);
		});

		it('CONTROL: a subscriber of the other tenant does receive that event', async () => {
			const subject = resolver();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const stream = subscribe(TENANT_B, ORG_B, () => (open as any)(subject));

			const theirs = event(TENANT_B, ORG_B, 'item-b');
			await as(TENANT_B, ORG_B, () => bus.publish(theirs));

			expect(await delivered(stream)).toEqual([theirs]);
		});

		it('hands graphql-js the event itself as the field value', () => {
			const subject = resolver();
			const method = (subject as unknown as Record<string, unknown>)[field];
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, method)).toMatchObject({
				resolve: deliverPayloadAsIs
			});
		});
	});
});
