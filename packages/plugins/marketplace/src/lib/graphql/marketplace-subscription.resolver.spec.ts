/**
 * The marketplace streams (`sellerChanged`, `sellerOfferingChanged`, `sellerPayoutChanged`, `sellerSettlementChanged`,
 * `sellerTransactionChanged`), held to the subscriber's tenant, organization and seller.
 *
 * The facts reach the fields the way they do in the running API: the outbox consumer publishes each appended
 * marketplace event on `<event>:<tenantId>` of `GraphqlPubSub`, and the fields follow those topics. The cases publish
 * envelopes on the real `GraphqlPubSub` — on another tenant's topic, mis-published onto the subscriber's topic while
 * naming another tenant, of another organization, of another seller, and of the subscriber's own — and assert the
 * subscriber hears its own and nothing else.
 *
 * **The kernel is the real one where isolation lives** (`tenantScopedTopicStream`, `GraphqlPubSub`, `RequestContext`
 * over a real CLS store, the permission and feature decorators); the rest of `@gauzy/core` is doubled at the module
 * boundary, as this package's other suites do. The five services are doubled with the scoping their getters perform:
 * the caller's tenant and organization from `RequestContext`, and `assertSellerScope` for a seller's own person.
 * The access guard is the marketplace's; here it is a stand-in class, and the scope it would attach is put on the
 * operation's context the way it attaches it.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const subscription = jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/plugin-subscription');

	return {
		FEATURE_GRAPHQL: jest.requireActual('@gauzy/core/src/lib/feature/graphql-feature.code').FEATURE_GRAPHQL,
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		GraphqlPubSub: jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/graphql-pubsub.service').GraphqlPubSub,
		RequestContext: jest.requireActual('@gauzy/core/src/lib/core/context/request-context').RequestContext,
		deliverPayloadAsIs: subscription.deliverPayloadAsIs,
		tenantScopedTopicStream: subscription.tenantScopedTopicStream,
		declareStreamedEvents: subscription.declareStreamedEvents,
		SubscriptionCatalogue: class SubscriptionCatalogue {},
		GraphqlSubscriptionConsumer: class GraphqlSubscriptionConsumer {}
	};
});

jest.mock('../seller-scope/seller-access.guard', () => ({ SellerAccessGuard: class SellerAccessGuard {} }));
jest.mock('../seller/seller.service', () => ({ SellerService: class SellerService {} }));
jest.mock('../seller/seller.entity', () => ({ Seller: class Seller {} }));
jest.mock('../seller-offering/seller-offering.service', () => ({ SellerOfferingService: class SellerOfferingService {} }));
jest.mock('../seller-offering/seller-offering.entity', () => ({ SellerOffering: class SellerOffering {} }));
jest.mock('../seller-payout/seller-payout.service', () => ({ SellerPayoutService: class SellerPayoutService {} }));
jest.mock('../seller-payout/seller-payout.entity', () => ({ SellerPayout: class SellerPayout {} }));
jest.mock('../seller-settlement/seller-settlement.service', () => ({
	SellerSettlementService: class SellerSettlementService {}
}));
jest.mock('../seller-settlement/seller-settlement.entity', () => ({ SellerSettlement: class SellerSettlement {} }));
jest.mock('../seller-transaction/seller-transaction.service', () => ({
	SellerTransactionService: class SellerTransactionService {}
}));
jest.mock('../seller-transaction/seller-transaction.entity', () => ({ SellerTransaction: class SellerTransaction {} }));

import { AsyncLocalStorage } from 'async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Kind, ObjectTypeExtensionNode, print } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { featureFlagsOf } from '@gauzy/common';
import { FEATURE_GRAPHQL, GraphqlPubSub, RequestContext, deliverPayloadAsIs } from '@gauzy/core';
import { MarketplaceFeatures } from '../marketplace.features';
import { MARKETPLACE_STREAMED_EVENTS } from '../marketplace-streamed-events';
import { schemaExtensions } from './schema-extensions';
import { MarketplaceSubscriptionResolver, marketplaceStreamNamesOf } from './marketplace-subscription.resolver';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';
const ORG_B = 'organization-b';

type Row = { id: string; tenantId: string; organizationId: string; sellerId?: string; orderId?: string };

/** One row per tenant, organization and seller, for every aggregate: the seller's own id doubles as `sellerId`. */
const rowsOf = (prefix: string): Row[] => [
	{ id: `${prefix}-a`, tenantId: TENANT_A, organizationId: ORG_A, sellerId: 'seller-a', orderId: 'order-a' },
	{ id: `${prefix}-a-other`, tenantId: TENANT_A, organizationId: ORG_A, sellerId: 'seller-a-other', orderId: 'order-a' },
	{ id: `${prefix}-a2`, tenantId: TENANT_A, organizationId: ORG_A2, sellerId: 'seller-a2', orderId: 'order-a2' },
	{ id: `${prefix}-b`, tenantId: TENANT_B, organizationId: ORG_B, sellerId: 'seller-b', orderId: 'order-b' }
];

const SELLERS: Row[] = [
	{ id: 'seller-a', tenantId: TENANT_A, organizationId: ORG_A },
	{ id: 'seller-a-other', tenantId: TENANT_A, organizationId: ORG_A },
	{ id: 'seller-a2', tenantId: TENANT_A, organizationId: ORG_A2 },
	{ id: 'seller-b', tenantId: TENANT_B, organizationId: ORG_B }
];
const OFFERINGS = rowsOf('offering');
const PAYOUTS = rowsOf('payout');
const SETTLEMENTS = rowsOf('settlement');
const TRANSACTIONS = rowsOf('transaction');

/** Runs work as a signed-in user of one tenant and organization. */
const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
	RequestContext.runWithRequest(
		{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
		work
	);

/** Opens a stream as graphql-js does: resolved as the subscriber, iterator taken before anything is published. */
const subscribe = (tenantId: string, organizationId: string, open: () => unknown): AsyncIterator<unknown> =>
	as(tenantId, organizationId, () => (open() as AsyncIterable<unknown>)[Symbol.asyncIterator]());

/** Everything an opened stream delivers until it has been quiet for a moment. */
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<any[]> => {
	const values: any[] = [];
	for (;;) {
		let timer: NodeJS.Timeout | undefined;
		const quiet = new Promise<'quiet'>((resolve) => (timer = setTimeout(() => resolve('quiet'), quietMs)));
		const next = await Promise.race([iterator.next(), quiet]);
		clearTimeout(timer);
		if (next === 'quiet' || next.done) break;
		values.push(next.value);
	}
	await iterator.return?.();
	return values;
};

/** The envelope the outbox consumer publishes for one appended marketplace event. */
const envelope = (name: string, row: Row, overrides: Record<string, unknown> = {}) => ({
	eventId: `${name}:${row.id}`,
	name,
	occurredAt: new Date(0),
	tenantId: row.tenantId,
	organizationId: row.organizationId,
	aggregate: { type: 'MARKETPLACE', id: row.id },
	data: { sellerId: row.sellerId ?? row.id },
	...overrides
});

/** The context `SellerAccessGuard` leaves behind: the scope on the operation's request. */
const staff = { req: { sellerScope: { staff: true } } };
const sellerPerson = (sellerId: string) => ({ req: { sellerScope: { sellerId, staff: false, contactId: 'party' } } });

/**
 * A getter as the marketplace services write it: the caller's tenant and organization from `RequestContext`, and
 * the seller scope asserted for a seller's own person.
 */
const scopedGetter = (rows: Row[], reads: string[], sellerOf: (row: Row) => string | undefined = (row) => row.sellerId) =>
	jest.fn(async (id: string, scope?: { sellerId?: string; staff?: boolean }) => {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		reads.push(`${id}@${tenantId}/${organizationId}`);
		const row = rows.find(
			(candidate) =>
				candidate.id === id &&
				candidate.tenantId === tenantId &&
				(!organizationId || candidate.organizationId === organizationId)
		);
		if (!row) throw new NotFoundException('not found');
		if (scope && !scope.staff && scope.sellerId !== sellerOf(row)) {
			throw new ForbiddenException(`This credential is not valid for seller '${sellerOf(row)}'.`);
		}
		return { ...row };
	});

describe('the marketplace subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: string[];
	let resolver: MarketplaceSubscriptionResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		resolver = new MarketplaceSubscriptionResolver(
			{ getSeller: scopedGetter(SELLERS, reads, (row) => row.id) } as never,
			{ getOffering: scopedGetter(OFFERINGS, reads) } as never,
			{ getPayout: scopedGetter(PAYOUTS, reads) } as never,
			{ getSettlement: scopedGetter(SETTLEMENTS, reads) } as never,
			{ getTransaction: scopedGetter(TRANSACTIONS, reads) } as never,
			pubSub
		);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	/** Each row-shaped stream, with the fact it follows and the rows it re-reads. */
	const ROW_STREAMS: Array<{
		field: string;
		name: string;
		rows: Row[];
		open: (r: MarketplaceSubscriptionResolver, context: unknown) => unknown;
	}> = [
		{ field: 'sellerChanged', name: 'seller.activated', rows: SELLERS, open: (r, c) => r.sellerChanged(undefined, undefined, c) },
		{
			field: 'sellerOfferingChanged',
			name: 'seller_offering.withdrawn',
			rows: OFFERINGS,
			open: (r, c) => r.sellerOfferingChanged(undefined, undefined, undefined, c)
		},
		{
			field: 'sellerPayoutChanged',
			name: 'seller_payout.paid',
			rows: PAYOUTS,
			open: (r, c) => r.sellerPayoutChanged(undefined, undefined, undefined, c)
		},
		{
			field: 'sellerSettlementChanged',
			name: 'seller_settlement.closed',
			rows: SETTLEMENTS,
			open: (r, c) => r.sellerSettlementChanged(undefined, undefined, undefined, c)
		}
	];

	describe.each(ROW_STREAMS)('$field', ({ name, rows, open }) => {
		it("delivers its own tenant's move, re-read as the subscriber, and nothing of another tenant", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => open(resolver, staff));

			await publish(envelope(name, rows[3])); // tenant B, on B's topic
			await publish(envelope(name, rows[3]), TENANT_A); // tenant B, mis-published onto A's topic
			await publish(envelope(name, rows[0], { tenantId: undefined }), TENANT_A); // states no tenant
			await publish(envelope(name, rows[0])); // tenant A, organization A

			expect((await delivered(stream)).map((row) => row.id)).toEqual([rows[0].id]);
			expect(reads).toEqual([`${rows[0].id}@${TENANT_A}/${ORG_A}`]);
		});

		it('delivers nothing of another organization of the same tenant', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => open(resolver, staff));

			await publish(envelope(name, rows[2]));
			await publish(envelope(name, rows[2], { organizationId: undefined }));

			expect(await delivered(stream)).toEqual([]);
		});

		it("narrows a seller's own person to its own seller, as the queries narrow it", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => open(resolver, sellerPerson('seller-a')));

			await publish(envelope(name, rows[1])); // the same tenant and organization, another seller
			await publish(envelope(name, rows[0])); // its own seller

			expect((await delivered(stream)).map((row) => row.id)).toEqual([rows[0].id]);
		});

		it("tenant B's subscriber does hear tenant B's move — the control for the negative cases", async () => {
			const stream = subscribe(TENANT_B, ORG_B, () => open(resolver, staff));

			await publish(envelope(name, rows[0]));
			await publish(envelope(name, rows[3]));

			expect((await delivered(stream)).map((row) => row.id)).toEqual([rows[3].id]);
		});
	});

	it('narrows by the row, by the seller and by the action, and only narrows', async () => {
		const bySeller = subscribe(TENANT_A, ORG_A, () => resolver.sellerChanged('seller-a-other', undefined, staff));
		const byAction = subscribe(TENANT_A, ORG_A, () => resolver.sellerChanged(undefined, 'offboarding-started', staff));
		const payoutsOfSeller = subscribe(TENANT_A, ORG_A, () =>
			resolver.sellerPayoutChanged(undefined, 'seller-a', undefined, staff)
		);
		const onePayout = subscribe(TENANT_A, ORG_A, () =>
			resolver.sellerPayoutChanged('payout-a-other', undefined, 'failed', staff)
		);

		await publish(envelope('seller.updated', SELLERS[0]));
		await publish(envelope('seller.offboarding-started', SELLERS[1]));
		await publish(envelope('seller_payout.paid', PAYOUTS[0]));
		await publish(envelope('seller_payout.paid', PAYOUTS[1]));
		await publish(envelope('seller_payout.failed', PAYOUTS[1]));

		expect((await delivered(bySeller)).map((row) => row.id)).toEqual(['seller-a-other']);
		expect((await delivered(byAction)).map((row) => row.id)).toEqual(['seller-a-other']);
		expect((await delivered(payoutsOfSeller)).map((row) => row.id)).toEqual(['payout-a']);
		expect((await delivered(onePayout)).map((row) => row.id)).toEqual(['payout-a-other']);
	});

	it('follows exactly the streamed names of each aggregate — never the withheld price edit, never the ledger under `seller.*`', async () => {
		expect(marketplaceStreamNamesOf('seller')).toEqual([
			'seller.created',
			'seller.updated',
			'seller.submitted',
			'seller.verified',
			'seller.activated',
			'seller.suspended',
			'seller.rejected',
			'seller.offboarding-started'
		]);
		expect(marketplaceStreamNamesOf('seller_offering')).toEqual(['seller_offering.created', 'seller_offering.withdrawn']);
		expect(marketplaceStreamNamesOf('seller.transaction')).toEqual([
			'seller.transaction.recorded',
			'seller.transaction.settleable',
			'seller.transaction.reversed'
		]);
		const covered = ['seller', 'seller_offering', 'seller_payout', 'seller_settlement', 'seller.transaction'].flatMap(
			marketplaceStreamNamesOf
		);
		expect([...covered].sort()).toEqual([...MARKETPLACE_STREAMED_EVENTS].sort());

		const sellers = subscribe(TENANT_A, ORG_A, () => resolver.sellerChanged(undefined, undefined, staff));
		const offerings = subscribe(TENANT_A, ORG_A, () =>
			resolver.sellerOfferingChanged(undefined, undefined, undefined, staff)
		);

		await publish(envelope('seller.transaction.recorded', SELLERS[0])); // a ledger fact, not the seller's
		await publish(envelope('seller_offering.updated', OFFERINGS[0])); // withheld: a price write
		await publish(envelope('seller.submitted', SELLERS[0]));
		await publish(envelope('seller_offering.created', OFFERINGS[0]));

		expect((await delivered(sellers)).map((row) => row.id)).toEqual(['seller-a']);
		expect((await delivered(offerings)).map((row) => row.id)).toEqual(['offering-a']);
	});

	describe('sellerTransactionChanged', () => {
		/** `seller.transaction.recorded` is the order's fact, and names the rows it wrote. */
		const recorded = (rows: Row[], overrides: Record<string, unknown> = {}) =>
			envelope('seller.transaction.recorded', rows[0], {
				aggregate: { type: 'SELLER_TRANSACTION', id: rows[0].orderId },
				data: { orderId: rows[0].orderId, transactionIds: rows.map((row) => row.id) },
				...overrides
			});

		it('answers every row a recorded sale wrote, each re-read as the subscriber', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.sellerTransactionChanged(undefined, undefined, undefined, staff));

			await publish(recorded([TRANSACTIONS[0], TRANSACTIONS[1]]));

			const [rows] = await delivered(stream);
			expect(rows.map((row: Row) => row.id)).toEqual(['transaction-a', 'transaction-a-other']);
			// The order the aggregate names is never read as a row.
			expect(reads).toEqual([`transaction-a@${TENANT_A}/${ORG_A}`, `transaction-a-other@${TENANT_A}/${ORG_A}`]);
		});

		it("answers a seller's own person only its own seller's rows, and nothing for a move that touched none", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () =>
				resolver.sellerTransactionChanged(undefined, undefined, undefined, sellerPerson('seller-a'))
			);

			await publish(recorded([TRANSACTIONS[1]])); // only another seller's row
			await publish(recorded([TRANSACTIONS[0], TRANSACTIONS[1]]));

			const frames = await delivered(stream);
			expect(frames.map((rows) => rows.map((row: Row) => row.id))).toEqual([['transaction-a']]);
		});

		it('never reads a row of another tenant or organization, whichever ids the fact names', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.sellerTransactionChanged(undefined, undefined, undefined, staff));

			// An envelope of the subscriber's own tenant that names another tenant's and another organization's rows.
			await publish(recorded([TRANSACTIONS[0]], { data: { transactionIds: [TRANSACTIONS[3].id, TRANSACTIONS[2].id] } }));
			await publish(recorded([TRANSACTIONS[3]])); // tenant B

			expect(await delivered(stream)).toEqual([]);
		});

		it('reads a settleable row and a reversal by their own ids, and narrows by seller, order and action', async () => {
			const settleable = envelope('seller.transaction.settleable', TRANSACTIONS[0], {
				aggregate: { type: 'SELLER_TRANSACTION', id: TRANSACTIONS[0].id },
				data: { transactionId: TRANSACTIONS[0].id }
			});
			const reversed = envelope('seller.transaction.reversed', TRANSACTIONS[1], {
				aggregate: { type: 'SELLER_TRANSACTION', id: TRANSACTIONS[1].id },
				data: { transactionId: TRANSACTIONS[0].id, reversalId: TRANSACTIONS[1].id }
			});
			const all = subscribe(TENANT_A, ORG_A, () => resolver.sellerTransactionChanged(undefined, undefined, undefined, staff));
			const reversals = subscribe(TENANT_A, ORG_A, () =>
				resolver.sellerTransactionChanged(undefined, undefined, 'reversed', staff)
			);
			const ofSeller = subscribe(TENANT_A, ORG_A, () =>
				resolver.sellerTransactionChanged('seller-a-other', undefined, undefined, staff)
			);
			const ofAnotherOrder = subscribe(TENANT_A, ORG_A, () =>
				resolver.sellerTransactionChanged(undefined, 'order-b', undefined, staff)
			);

			await publish(settleable);
			await publish(reversed);

			const ids = (frames: any[]) => frames.map((rows) => rows.map((row: Row) => row.id));
			expect(ids(await delivered(all))).toEqual([['transaction-a'], ['transaction-a-other', 'transaction-a']]);
			expect(ids(await delivered(reversals))).toEqual([['transaction-a-other', 'transaction-a']]);
			expect(ids(await delivered(ofSeller))).toEqual([['transaction-a-other']]);
			expect(await delivered(ofAnotherOrder)).toEqual([]);
		});
	});

	it('refuses to open any stream for a caller with no tenant', () => {
		const noTenant = (open: () => unknown) => () => RequestContext.runWithRequest({ user: undefined } as never, open);

		expect(noTenant(() => resolver.sellerChanged(undefined, undefined, staff))).toThrow(/no tenant/);
		expect(noTenant(() => resolver.sellerOfferingChanged(undefined, undefined, undefined, staff))).toThrow(/no tenant/);
		expect(noTenant(() => resolver.sellerPayoutChanged(undefined, undefined, undefined, staff))).toThrow(/no tenant/);
		expect(noTenant(() => resolver.sellerSettlementChanged(undefined, undefined, undefined, staff))).toThrow(/no tenant/);
		expect(noTenant(() => resolver.sellerTransactionChanged(undefined, undefined, undefined, staff))).toThrow(/no tenant/);
	});

	it('carries the queries’ guards, features and view permissions, and delivers its payload as is', () => {
		const handler = (name: string) => (MarketplaceSubscriptionResolver.prototype as any)[name];
		const permissions: Record<string, string> = {
			sellerChanged: PermissionsEnum.SELLERS_VIEW,
			sellerOfferingChanged: PermissionsEnum.SELLER_OFFERINGS_VIEW,
			sellerPayoutChanged: PermissionsEnum.SELLER_PAYOUTS_VIEW,
			sellerSettlementChanged: PermissionsEnum.SELLER_SETTLEMENTS_VIEW,
			sellerTransactionChanged: PermissionsEnum.SELLER_TRANSACTIONS_VIEW
		};

		for (const [name, permission] of Object.entries(permissions)) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler(name))).toEqual([permission]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler(name))).toEqual(
				expect.objectContaining({ resolve: deliverPayloadAsIs })
			);
		}

		expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, MarketplaceSubscriptionResolver)).sort()).toEqual(
			[FEATURE_GRAPHQL, MarketplaceFeatures.MARKETPLACE].sort()
		);
		for (const name of ['sellerPayoutChanged', 'sellerSettlementChanged']) {
			expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, handler(name))).sort()).toEqual(
				[FEATURE_GRAPHQL, MarketplaceFeatures.MARKETPLACE, MarketplaceFeatures.PAYOUTS].sort()
			);
		}

		const guards = (Reflect.getMetadata('__guards__', MarketplaceSubscriptionResolver) ?? []).map(
			(guard: Function) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard', 'SellerAccessGuard']);
	});

	it('is registered with the package’s resolvers, and the schema declares all five fields', () => {
		// Read as source: the barrel loads every resolver of the package, and their bases are the kernel's.
		const barrel = readFileSync(join(__dirname, 'resolvers.ts'), 'utf8');
		expect(barrel).toMatch(/export const resolvers = \[[^\]]*\bMarketplaceSubscriptionResolver\b[^\]]*\]/);

		const fields = schemaExtensions.definitions
			.filter(
				(definition): definition is ObjectTypeExtensionNode =>
					definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Subscription'
			)
			.flatMap((definition) => [...(definition.fields ?? [])]);
		const signatures = Object.fromEntries(
			fields.map((field) => [
				field.name.value,
				`(${(field.arguments ?? []).map((argument) => `${argument.name.value}: ${print(argument.type)}`).join(', ')}): ${print(field.type)}`
			])
		);

		expect(signatures).toEqual({
			sellerChanged: '(sellerId: ID, action: String): Seller!',
			sellerOfferingChanged: '(sellerOfferingId: ID, sellerId: ID, action: String): SellerOffering!',
			sellerPayoutChanged: '(sellerPayoutId: ID, sellerId: ID, action: String): SellerPayout!',
			sellerSettlementChanged: '(sellerSettlementId: ID, sellerId: ID, action: String): SellerSettlement!',
			sellerTransactionChanged: '(sellerId: ID, orderId: ID, action: String): [SellerTransaction!]!'
		});
	});
});
