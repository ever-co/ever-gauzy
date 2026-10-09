/**
 * The six payment lifecycle streams the SDL declared and nothing served.
 *
 * `paymentAuthorized`, `paymentFailed`, `paymentCanceled`, `paymentCaptured`, `paymentRefunded` and
 * `refundCreated` were recorded as unbound: a client could subscribe and would never hear anything. They
 * are served over the kernel's tenant-scoped stream, and the cases below hold each of them to the three
 * things that make a payment stream safe to serve — it delivers a subscriber its own tenant's movement,
 * it delivers nothing of another tenant's (published, as in the running API, inside that tenant's own
 * request), and it states the view grant its REST twin states.
 *
 * Nothing is doubled but the services. Their reads scope themselves the way `PaymentScopedCrudService`
 * does — by the caller's tenant and organization, read from the request context — so a read made in the
 * publisher's context rather than the subscriber's would be visible here.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { NotFoundException } from '@nestjs/common';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { ClsService } from 'nestjs-cls';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { deliverPayloadAsIs, EventBus, RequestContext } from '@gauzy/core';
import {
	PaymentAuthorizedEvent,
	PaymentCanceledEvent,
	PaymentCapturedEvent,
	PaymentFailedEvent,
	PaymentRefundedEvent,
	RefundCreatedEvent
} from '../../events';
import { PaymentPermission } from '../../payment.permissions';
import { PaymentSessionResolver } from './payment-session.resolver';
import { RefundResolver } from './refund.resolver';

type Row = Record<string, any>;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_B = 'organization-b';

const SESSIONS: Row[] = [
	{ id: 'session-a', tenantId: TENANT_A, organizationId: ORG_A, amount: '10', currency: 'USD' },
	{ id: 'session-b', tenantId: TENANT_B, organizationId: ORG_B, amount: '20', currency: 'USD' }
];
const CAPTURES: Row[] = [
	{ id: 'capture-a', paymentId: 'payment-a', tenantId: TENANT_A, organizationId: ORG_A, amount: '10' },
	{ id: 'capture-b', paymentId: 'payment-b', tenantId: TENANT_B, organizationId: ORG_B, amount: '20' }
];
const REFUNDS: Row[] = [
	{ id: 'refund-a', orderId: 'order-a', tenantId: TENANT_A, organizationId: ORG_A, amount: '10' },
	{ id: 'refund-b', orderId: 'order-b', tenantId: TENANT_B, organizationId: ORG_B, amount: '20' }
];

/** A read scoped the way `PaymentScopedCrudService` scopes one: the caller's tenant and organization. */
const scopedRead = (rows: Row[], code: string) =>
	jest.fn(async (id: string) => {
		const row = rows.find(
			(candidate) =>
				candidate.id === id &&
				candidate.tenantId === RequestContext.currentTenantId() &&
				candidate.organizationId === RequestContext.currentOrganizationId()
		);

		if (!row) {
			throw new NotFoundException(code);
		}

		return row;
	});

/** Runs work as a signed-in user of one tenant and organization. */
const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
	RequestContext.runWithRequest(
		{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
		work
	);

/**
 * Opens a stream the way graphql-js does: the field is resolved as the subscriber, and the iterator is
 * taken from it at once — before any event is published — so an adapter that only starts listening when
 * it is iterated is listening by the time the other tenant writes.
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

describe('the payment subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let bus: EventBus;
	let sessions: PaymentSessionResolver;
	let refunds: RefundResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		bus = new EventBus();
		sessions = new PaymentSessionResolver(
			{ findSessionOrFail: scopedRead(SESSIONS, 'PAYMENT_SESSION_NOT_FOUND') } as never,
			{ findCaptureOrFail: scopedRead(CAPTURES, 'PAYMENT_CAPTURE_NOT_FOUND') } as never,
			bus
		);
		refunds = new RefundResolver(
			{ findRefundOrFail: scopedRead(REFUNDS, 'REFUND_NOT_FOUND') } as never,
			{} as never,
			bus
		);
	});

	/** Each field, the resolver that serves it, the grant it states, and the event of one row. */
	const FIELDS = [
		{
			field: 'paymentAuthorized',
			resolver: () => sessions,
			permission: PaymentPermission.PAYMENT_SESSIONS_VIEW,
			rows: SESSIONS,
			event: (row: Row) =>
				new PaymentAuthorizedEvent(row.id, row.amount, 'USD', 'collection', row.organizationId, row.tenantId)
		},
		{
			field: 'paymentFailed',
			resolver: () => sessions,
			permission: PaymentPermission.PAYMENT_SESSIONS_VIEW,
			rows: SESSIONS,
			event: (row: Row) =>
				new PaymentFailedEvent(
					row.id,
					'collection',
					row.amount,
					'USD',
					'CARD_DECLINED',
					row.organizationId,
					row.tenantId
				)
		},
		{
			field: 'paymentCanceled',
			resolver: () => sessions,
			permission: PaymentPermission.PAYMENT_SESSIONS_VIEW,
			rows: SESSIONS,
			event: (row: Row) =>
				new PaymentCanceledEvent(row.id, 'collection', row.amount, 'USD', row.organizationId, row.tenantId)
		},
		{
			field: 'paymentCaptured',
			resolver: () => sessions,
			permission: PaymentPermission.PAYMENT_SESSIONS_VIEW,
			rows: CAPTURES,
			event: (row: Row) =>
				new PaymentCapturedEvent(row.id, row.paymentId, row.amount, 'USD', row.organizationId, row.tenantId)
		},
		{
			field: 'paymentRefunded',
			resolver: () => refunds,
			permission: PaymentPermission.REFUNDS_VIEW,
			rows: REFUNDS,
			event: (row: Row) =>
				new PaymentRefundedEvent(row.id, 'payment', row.amount, 'USD', row.organizationId, row.tenantId)
		},
		{
			field: 'refundCreated',
			resolver: () => refunds,
			permission: PaymentPermission.REFUNDS_VIEW,
			rows: REFUNDS,
			event: (row: Row) =>
				new RefundCreatedEvent(row.id, row.orderId, row.amount, 'USD', row.organizationId, row.tenantId)
		}
	];

	describe.each(FIELDS)('$field', ({ field, resolver, permission, rows, event }) => {
		it("delivers a subscriber its own tenant's movement, re-read as the subscriber, and nothing of another tenant's", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => (resolver() as any)[field]());

			await as(TENANT_B, ORG_B, () => bus.publish(event(rows[1])));
			await as(TENANT_A, ORG_A, () => bus.publish(event(rows[0])));

			expect(await delivered(stream)).toEqual([rows[0]]);
		});

		it("delivers nothing of another tenant's to a subscriber that named that tenant's organization", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => (resolver() as any)[field](ORG_B));

			await as(TENANT_B, ORG_B, () => bus.publish(event(rows[1])));

			expect(await delivered(stream)).toEqual([]);
		});

		it('narrows to the organization the subscriber named', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => (resolver() as any)[field]('another-organization'));

			await as(TENANT_A, ORG_A, () => bus.publish(event(rows[0])));

			expect(await delivered(stream)).toEqual([]);
		});

		it('states the view grant its REST twin states, and delivers the row as the payload', () => {
			const handler = (resolver().constructor as any).prototype[field];

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([permission]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)?.resolve).toBe(deliverPayloadAsIs);
		});

		it('refuses to open a stream for an operation with no tenant', () => {
			expect(() => (resolver() as any)[field]()).toThrow('no tenant');
		});
	});

	it('drops a capture event that states no tenant, even one the re-read would find', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => sessions.paymentCaptured());

		await as(TENANT_A, ORG_A, () =>
			bus.publish(new PaymentCapturedEvent('capture-a', 'payment-a', '10', 'USD', ORG_A))
		);

		expect(await delivered(stream)).toEqual([]);
	});

	it('drops a session event that states no tenant', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => sessions.paymentAuthorized());

		await as(TENANT_A, ORG_A, () =>
			bus.publish(new PaymentAuthorizedEvent('session-a', '10', 'USD', 'collection', ORG_A))
		);

		expect(await delivered(stream)).toEqual([]);
	});
});
