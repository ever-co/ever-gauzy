/**
 * The three right streams, held to the subscriber's tenant.
 *
 * `entitlementChanged`, `entitlementActivated` and `entitlementRevoked` re-read every event through
 * `EntitlementService.findOneScoped`, which looked like a tenant predicate and was not one: the scope it
 * reads by default is the request context's, and the bus calls its observers synchronously inside the
 * **publisher's** request. The read ran as the tenant that wrote the right, found it, and delivered it to
 * every subscriber of every tenant; a read that failed delivered an `undefined` frame.
 *
 * The cases below open each stream as a user of tenant A and publish as a user of tenant B, with a real
 * CLS store behind `RequestContext`, and assert that the subscriber hears its own tenant's right and
 * nothing of the other's. Nothing is doubled but the service, whose `findOneScoped` reads exactly as the
 * real one does — the scope it is handed, falling back to the request context — so a read made in the
 * wrong context is visible.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { deliverPayloadAsIs, EventBus, RequestContext } from '@gauzy/core';
import { EntitlementPermissions } from '../../entitlement.permissions';
import {
	EntitlementActivatedEvent,
	EntitlementChangedEvent,
	EntitlementRevokedEvent
} from '../../events/entitlement.events';
import { EntitlementResolver } from './entitlement.resolver';

type Row = Record<string, any>;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';
const ORG_B = 'organization-b';

const RIGHTS: Row[] = [
	{ id: 'right-a', tenantId: TENANT_A, organizationId: ORG_A, revokedReason: 'REFUND' },
	{ id: 'right-a2', tenantId: TENANT_A, organizationId: ORG_A2, revokedReason: 'REFUND' },
	{ id: 'right-b', tenantId: TENANT_B, organizationId: ORG_B, revokedReason: 'REFUND' }
];

/** `EntitlementService.findOneScoped`, as it reads: the scope it is handed, else the request context's. */
const service = {
	findOneScoped: jest.fn(async (id: string, scope: { tenantId?: string; organizationId?: string } = {}) => {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();
		const row = RIGHTS.find(
			(candidate) =>
				candidate.id === id &&
				(!tenantId || candidate.tenantId === tenantId) &&
				(!organizationId || candidate.organizationId === organizationId)
		);

		if (!row) {
			throw new NotFoundException('The entitlement was not found.');
		}

		return row;
	})
};

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

/** The event each field streams, for one right. */
const EVENTS = {
	entitlementChanged: (row: Row) => EntitlementChangedEvent.from(row as never),
	entitlementActivated: (row: Row) =>
		EntitlementActivatedEvent.from({ id: `activation-of-${row.id}`, deviceId: 'device' } as never, row as never),
	entitlementRevoked: (row: Row) => EntitlementRevokedEvent.from(row as never)
} as const;

describe('the entitlement subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let bus: EventBus;
	let resolver: EntitlementResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		bus = new EventBus();
		service.findOneScoped.mockClear();
		resolver = new EntitlementResolver(service as never, {} as never, {} as never, {} as never, bus);
	});

	describe.each(Object.keys(EVENTS) as Array<keyof typeof EVENTS>)('%s', (field) => {
		it("delivers a subscriber its own tenant's right and nothing of another tenant's", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver[field]());

			await as(TENANT_B, ORG_B, () => bus.publish(EVENTS[field](RIGHTS[2])));
			await as(TENANT_A, ORG_A, () => bus.publish(EVENTS[field](RIGHTS[0])));

			expect(await delivered(stream)).toEqual([RIGHTS[0]]);
		});

		it("delivers nothing — not even an empty frame — for another tenant's right the subscriber named", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver[field]('right-b'));

			await as(TENANT_B, ORG_B, () => bus.publish(EVENTS[field](RIGHTS[2])));

			expect(await delivered(stream)).toEqual([]);
		});

		it('states its view grant and delivers the right as the payload', () => {
			const handler = (EntitlementResolver.prototype as any)[field];

			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handler) ??
					Reflect.getMetadata(PERMISSIONS_METADATA, EntitlementResolver)
			).toEqual([EntitlementPermissions.ENTITLEMENTS_VIEW]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)?.resolve).toBe(deliverPayloadAsIs);
		});
	});

	it("re-reads with the subscriber's tenant and organization stated, whoever published", async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.entitlementChanged());

		await as(TENANT_B, ORG_B, () => bus.publish(EntitlementChangedEvent.from(RIGHTS[0] as never)));

		expect(await delivered(stream)).toEqual([RIGHTS[0]]);
		expect(service.findOneScoped).toHaveBeenCalledWith('right-a', { tenantId: TENANT_A, organizationId: ORG_A });
	});

	it("keeps another organization's right of the same tenant from a subscriber acting in its own", async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.entitlementChanged());

		await as(TENANT_A, ORG_A2, () => bus.publish(EntitlementChangedEvent.from(RIGHTS[1] as never)));

		expect(await delivered(stream)).toEqual([]);
	});

	it('refuses to open a stream for an operation with no tenant', () => {
		expect(() => resolver.entitlementChanged()).toThrow('no tenant');
	});
});
