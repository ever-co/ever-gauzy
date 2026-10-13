/**
 * The catalogue's three subscription streams, held to the subscriber's tenant.
 *
 * `collectionChanged`, `productPublished` and `productUnpublished` read the in-process bus and narrowed on
 * the ids their arguments named and on nothing else, so a subscriber holding the view grant was handed
 * every change any tenant made to its collections and publications. The cases below open each stream
 * as a user of tenant A and publish as a user of tenant B — the way a mutation of another tenant reaches
 * the bus in the running API, inside that tenant's request — and assert that the subscriber hears its
 * own tenant's change and nothing of the other's.
 *
 * **Nothing is doubled but the services**, as in this package's soft-delete suite: the resolvers, the bus,
 * the kernel's stream and `RequestContext` over a real CLS store are the real ones, so the request the bus
 * calls back in is the publisher's, exactly as it is in production. The services answer from a table and
 * scope themselves the way `TenantAwareCrudService` does — by the caller's tenant — which is what makes a
 * read in the wrong context visible.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { deliverPayloadAsIs, EventBus, RequestContext } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionChangedEvent, ProductPublishedEvent, ProductUnpublishedEvent } from '../../events';
import { CollectionResolver } from './collection.resolver';
import { ProductPublicationResolver } from './product-publication.resolver';

type Row = Record<string, any>;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_B = 'organization-b';

const COLLECTIONS: Row[] = [
	{ id: 'collection-a', slug: 'summer', tenantId: TENANT_A, organizationId: ORG_A },
	{ id: 'collection-b', slug: 'summer', tenantId: TENANT_B, organizationId: ORG_B }
];

const PUBLICATIONS: Row[] = [
	{ id: 'publication-a', productId: 'product-a', channelId: 'channel-a', tenantId: TENANT_A, organizationId: ORG_A },
	{ id: 'publication-b', productId: 'product-b', channelId: 'channel-b', tenantId: TENANT_B, organizationId: ORG_B }
];

/**
 * A service that reads the way `TenantAwareCrudService.findOneByWhereOptions` reads: the criterion it is
 * handed, with the caller's tenant spread over it, and a `NotFoundException`-shaped refusal when nothing
 * matches.
 */
const tenantAware = (rows: Row[]) => ({
	findOneByWhereOptions: jest.fn(async (where: Row) => {
		const user = RequestContext.currentUser();
		const criterion = { ...where, ...(user ? { tenantId: user.tenantId } : {}) };
		const row = rows.find((candidate) =>
			Object.entries(criterion).every(([key, value]) => candidate[key] === value)
		);

		if (!row) {
			throw new Error('The requested record was not found');
		}

		return row;
	})
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

describe('the catalogue subscriptions, scoped to the subscriber', () => {
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

	describe('collectionChanged', () => {
		it("delivers a subscriber its own tenant's change and nothing of another tenant's", async () => {
			const collections = tenantAware(COLLECTIONS);
			const resolver = new CollectionResolver(collections as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.collectionChanged());

			await as(TENANT_B, ORG_B, () => bus.publish(CollectionChangedEvent.from(COLLECTIONS[1] as never)));
			await as(TENANT_A, ORG_A, () => bus.publish(CollectionChangedEvent.from(COLLECTIONS[0] as never)));

			// The row `collection(id)` answers, not the event and not tenant B's row.
			expect(await delivered(stream)).toEqual([COLLECTIONS[0]]);
		});

		it("still delivers nothing of another tenant's when the subscriber names that tenant's collection", async () => {
			const resolver = new CollectionResolver(tenantAware(COLLECTIONS) as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.collectionChanged('collection-b'));

			await as(TENANT_B, ORG_B, () => bus.publish(CollectionChangedEvent.from(COLLECTIONS[1] as never)));

			expect(await delivered(stream)).toEqual([]);
		});

		it('re-reads the row with the subscriber’s tenant stated, as the subscriber', async () => {
			const collections = tenantAware(COLLECTIONS);
			const resolver = new CollectionResolver(collections as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.collectionChanged());

			await as(TENANT_A, ORG_A, () => bus.publish(CollectionChangedEvent.from(COLLECTIONS[0] as never)));

			expect(await delivered(stream)).toEqual([COLLECTIONS[0]]);
			expect(collections.findOneByWhereOptions).toHaveBeenCalledWith({ id: 'collection-a', tenantId: TENANT_A });
		});

		it('carries the tenant on the event it publishes', () => {
			expect(CollectionChangedEvent.from(COLLECTIONS[1] as never).tenantId).toBe(TENANT_B);
		});
	});

	describe('productPublished and productUnpublished', () => {
		const resolverWith = (publications = tenantAware(PUBLICATIONS)) =>
			new ProductPublicationResolver(publications as never, {} as never, bus);

		it("deliver a subscriber its own tenant's publication and nothing of another tenant's", async () => {
			const resolver = resolverWith();
			const published = subscribe(TENANT_A, ORG_A, () => resolver.productPublished());
			const unpublished = subscribe(TENANT_A, ORG_A, () => resolver.productUnpublished());

			await as(TENANT_B, ORG_B, () => bus.publish(ProductPublishedEvent.from(PUBLICATIONS[1] as never)));
			await as(TENANT_B, ORG_B, () => bus.publish(ProductUnpublishedEvent.from(PUBLICATIONS[1] as never)));
			await as(TENANT_A, ORG_A, () => bus.publish(ProductPublishedEvent.from(PUBLICATIONS[0] as never)));
			await as(TENANT_A, ORG_A, () => bus.publish(ProductUnpublishedEvent.from(PUBLICATIONS[0] as never)));

			expect(await delivered(published)).toEqual([PUBLICATIONS[0]]);
			expect(await delivered(unpublished)).toEqual([PUBLICATIONS[0]]);
		});

		it("deliver nothing of another tenant's to a subscriber that narrowed to that tenant's product", async () => {
			const resolver = resolverWith();
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.productPublished('product-b', 'channel-b'));

			await as(TENANT_B, ORG_B, () => bus.publish(ProductPublishedEvent.from(PUBLICATIONS[1] as never)));

			expect(await delivered(stream)).toEqual([]);
		});

		it('still narrow to the product and the channel the subscriber named', async () => {
			const resolver = resolverWith();
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.productPublished('product-a', 'another-channel'));

			await as(TENANT_A, ORG_A, () => bus.publish(ProductPublishedEvent.from(PUBLICATIONS[0] as never)));

			expect(await delivered(stream)).toEqual([]);
		});
	});

	describe('the declarations graphql-js reads', () => {
		it.each([
			[CollectionResolver, 'collectionChanged', CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW],
			[ProductPublicationResolver, 'productPublished', CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW],
			[ProductPublicationResolver, 'productUnpublished', CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW]
		])('%p.%s states its view grant and delivers the row as the payload', (resolver, field, permission) => {
			const handler = (resolver as any).prototype[field];

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([catalogPermission(permission)]);
			// Without `resolve` graphql-js reads `payload[field]`, which a row does not have, and every frame
			// answers "Cannot return null for non-nullable field".
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)?.resolve).toBe(deliverPayloadAsIs);
		});

		it('refuses to open a stream for an operation with no tenant', () => {
			const resolver = new CollectionResolver(tenantAware(COLLECTIONS) as never, bus);

			expect(() => resolver.collectionChanged()).toThrow('no tenant');
		});
	});
});
