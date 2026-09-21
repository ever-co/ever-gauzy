/**
 * The GraphQL surface answers a retry and a stale version exactly as the REST surface does.
 *
 * A caller picks a protocol; the rules do not. The mutations mirror the routes, so the two are asserted
 * against each other rather than against a restated table: whatever the route declares, the mutation
 * that mirrors it declares too — the same retry scope, the same versioned resource — and both name the
 * version and the retry key as nullable members, because a GraphQL operation travels over `POST`
 * whichever root type it selects and a header could not say which mutation either belongs to.
 *
 * The kernel's own decorators are the real ones here, since a route's behaviour is decided by the
 * metadata they write. `@gauzy/core`'s barrel is doubled at the module boundary for the reason the
 * package's other suites state, and the cart package's barrel with it, because the totals service
 * imports the shared calculator through it.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService: class {},
		TenantAwareCrudService: class {},
		CrudController: class {
			constructor(protected readonly service: any) {}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Permissions: decorator,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph and — under this
		// workspace's ESM-only `uuid` — fails the whole suite to LOAD. What this suite reads is the
		// metadata the decorator writes, so that is what the double writes.
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		// The connection helpers the list fields page and answer with, taken from the kernel: a double that
		// left them undefined would have the suite fail with "not a function" the moment a case called one
		// of those fields, rather than tell it anything about the page it answered.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		// The validation pipe the resolvers' routes build at class-definition time; Nest refuses a pipe with
		// no `transform`, and the resolver file reaches it through this barrel.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {}
	};
});

import { Reflector } from '@nestjs/core';
import { OrderController } from '../order/order.controller';
import { OrderService } from '../order/order.service';
import { OrderResolver } from './order.resolver';
import { OrderChangeResolver } from './order-change.resolver';
import { orderSchemaExtensions } from './schema-extensions';

const { IDEMPOTENT_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
const { VERSIONED_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

const reflector = new Reflector();

/** What a handler declares about retrying it. */
const retryOf = (handler: any): any => reflector.get(IDEMPOTENT_METADATA_KEY, handler);

/** What a handler declares about the version it carries. */
const versionedOf = (handler: any): any => reflector.get(VERSIONED_METADATA_KEY, handler);

/** The operations the two surfaces share, as the route and the mutation that mirror each other. */
const MIRRORED: Array<{ route: any; mutation: any }> = [
	{ route: OrderController.prototype.findById, mutation: OrderResolver.prototype.order },
	{ route: OrderController.prototype.create, mutation: OrderResolver.prototype.createOrder },
	{ route: OrderController.prototype.update, mutation: OrderResolver.prototype.updateOrder },
	{ route: OrderController.prototype.place, mutation: OrderResolver.prototype.placeOrder },
	{ route: OrderController.prototype.cancel, mutation: OrderResolver.prototype.cancelOrder },
	{ route: OrderController.prototype.archive, mutation: OrderResolver.prototype.archiveOrder },
	{ route: OrderController.prototype.recalculate, mutation: OrderResolver.prototype.recalculateOrder },
	{ route: OrderController.prototype.createChange, mutation: OrderResolver.prototype.requestOrderEdit },
	{ route: OrderController.prototype.declineChange, mutation: OrderChangeResolver.prototype.declineOrderChange },
	{ route: OrderController.prototype.cancelChange, mutation: OrderChangeResolver.prototype.cancelOrderChange }
];

describe('The order mutations mirror the order routes', () => {
	it('carries the same retry scope on the mutation as on the route it mirrors', () => {
		for (const { route, mutation } of MIRRORED) {
			// The scope is part of the key's identity: a client that retries over the other protocol must
			// be answered from the same record, and two operations must never replay each other's answer.
			expect(retryOf(mutation)?.scope).toBe(retryOf(route)?.scope);
			expect(retryOf(mutation)?.required ?? false).toBe(retryOf(route)?.required ?? false);
		}

		// The confirmation is the fifth key-bearing operation and is compared on its own below, because
		// the two surfaces address it differently: the route names the order as well as the change, and
		// the mutation names only the change.
		expect(OrderChangeResolver.prototype.confirmOrderChange).toBeDefined();
		expect(retryOf(OrderController.prototype.confirmChange)?.scope).toBe('order.change.confirm');
		expect(retryOf(OrderChangeResolver.prototype.confirmOrderChange)?.scope).toBe('order.change.confirm');
		expect(retryOf(OrderChangeResolver.prototype.confirmOrderChange)?.required).toBe(true);

		// A control: the routes that adopted the convention are the ones compared, not two tables of
		// `undefined`.
		expect(MIRRORED.filter(({ route }) => retryOf(route) !== undefined).length).toBe(4);
	});

	it('carries the same versioned resource on the mutation as on the route it mirrors', () => {
		for (const { route, mutation } of MIRRORED) {
			expect(versionedOf(mutation)?.resource).toBe(versionedOf(route)?.resource);
			expect(versionedOf(mutation)?.write ?? true).toBe(versionedOf(route)?.write ?? true);
		}

		// A read states no version on either surface, so a caller that states none is still served.
		expect(versionedOf(OrderResolver.prototype.order)?.write).toBe(false);
	});

	it('takes the order’s version on the confirmation, and says so on whichever surface can', () => {
		// The route names the order in its path, so it declares the service that owns it and the guard
		// reads that order before the handler runs. The mutation names only the change, so it declares no
		// resource: the handler resolves the order, and the order's conditional update compares the
		// version. Neither takes a version of the change — the change has none.
		expect(versionedOf(OrderController.prototype.confirmChange)?.resource).toBe(OrderService);
		expect(versionedOf(OrderChangeResolver.prototype.confirmOrderChange)?.resource).toBeUndefined();
		expect(versionedOf(OrderChangeResolver.prototype.confirmOrderChange)?.write ?? true).toBe(true);
	});

	it('requires a retry key on the confirmation, and on nothing else that mirrors a key-optional route', () => {
		const required = [...MIRRORED.map(({ mutation }) => mutation), OrderChangeResolver.prototype.confirmOrderChange]
			.filter((mutation) => retryOf(mutation)?.required === true);

		expect(required.map((mutation) => retryOf(mutation).scope)).toEqual(['order.change.confirm']);
	});
});

describe('The order schema states the version and the retry key a caller supplies', () => {
	/** The schema, with the line breaks the template writes flattened so a declaration reads as one line. */
	const schema = (orderSchemaExtensions as any).loc.source.body.replace(/\s+/g, ' ');

	it('carries the version of both versioned aggregates on their object types', () => {
		for (const type of ['type Order {', 'type OrderChange {']) {
			const body = schema.slice(schema.indexOf(type), schema.indexOf('}', schema.indexOf(type)));

			expect({ type, version: body.includes('version: Int!') }).toEqual({ type, version: true });
		}
	});

	it('accepts the version an update of an order is based on', () => {
		const body = schema.slice(
			schema.indexOf('input UpdateOrderInput {'),
			schema.indexOf('}', schema.indexOf('input UpdateOrderInput {'))
		);

		// Nullable on purpose: the kernel answers a write that states none with the platform's own code,
		// which is the same answer the route gives.
		expect(body).toContain('version: Int');
		expect(body).not.toContain('version: Int!');
	});

	it('accepts a retry key wherever the route it mirrors honours one', () => {
		for (const declaration of [
			'input CreateOrderInput {',
			'input RequestOrderEditInput {',
			'placeOrder(id: ID!, version: Int, idempotencyKey: String): Order!',
			'cancelOrder(id: ID!, reason: String, version: Int, idempotencyKey: String): Order!',
			'confirmOrderChange(id: ID!, version: Int, idempotencyKey: String): OrderChange!'
		]) {
			expect({ declaration, declared: schema.includes(declaration) }).toEqual({ declaration, declared: true });
		}
	});

	it('answers every list field of the domain with the one connection shape, pageable', () => {
		// Four page types used to be `{ items, total }`, which told a client how many rows there are and
		// nothing about whether it had seen them all. The shape is asserted here as the client reads it.
		for (const [type, edge] of [
			['type OrderConnection {', 'OrderEdge'],
			['type OrderChangeConnection {', 'OrderChangeEdge'],
			['type OrderSummaryConnection {', 'OrderSummaryEdge'],
			['type OrderTransactionConnection {', 'OrderTransactionEdge']
		]) {
			const body = schema.slice(schema.indexOf(type), schema.indexOf('}', schema.indexOf(type)));

			for (const member of ['nodes: [', `edges: [${edge}!]!`, 'totalCount: Int!', 'pageInfo: PageInfo!']) {
				expect({ type, member, declares: body.includes(member) }).toEqual({ type, member, declares: true });
			}
		}

		// A connection whose field accepts no page can only ever answer one page, whatever its `pageInfo`
		// claims, so every field that answers one states the page it takes.
		for (const field of [
			'orderSummaries(orderId: ID!, page: PageInput)',
			'orderTransactions(orderId: ID!, type: String, page: PageInput)',
			'orderChanges(orderId: ID!, status: String, page: PageInput)'
		]) {
			expect({ field, declared: schema.includes(field) }).toEqual({ field, declared: true });
		}
	});

	it('answers the timeline and a line’s invoice links with that same shape, pageable', () => {
		// Both fields used to answer a bare array — `[OrderHistory!]!` and `[OrderLineInvoice!]!` — so a
		// client that had the REST list had nothing to page over GraphQL while the schema said otherwise.
		for (const [type, edge, row, field] of [
			['OrderHistoryConnection', 'OrderHistoryEdge', 'OrderHistory', 'orderHistory(orderId: ID!, page: PageInput)'],
			[
				'OrderLineInvoiceConnection',
				'OrderLineInvoiceEdge',
				'OrderLineInvoice',
				'orderLineInvoices(orderLineId: ID!, page: PageInput)'
			]
		]) {
			const body = schema.slice(schema.indexOf(`type ${type} {`), schema.indexOf('}', schema.indexOf(`type ${type} {`)));

			for (const member of [`nodes: [${row}!]!`, `edges: [${edge}!]!`, 'totalCount: Int!', 'pageInfo: PageInfo!']) {
				expect({ type, member, declares: body.includes(member) }).toEqual({ type, member, declares: true });
			}

			// The edge is what a client walks from, so it carries the row and the cursor that addresses
			// it: an edge type the document never declares is a selection that fails at request time.
			const edgeBody = schema.slice(
				schema.indexOf(`type ${edge} {`),
				schema.indexOf('}', schema.indexOf(`type ${edge} {`))
			);

			for (const member of [`node: ${row}!`, 'cursor: String!']) {
				expect({ edge, member, declares: edgeBody.includes(member) }).toEqual({ edge, member, declares: true });
			}

			expect({ field, connection: schema.includes(`${field}: ${type}!`) }).toEqual({ field, connection: true });
			// The control: the field no longer answers the bare array it used to.
			expect({ field, bare: schema.includes(`${field.replace(', page: PageInput', '')}: [${row}!]!`) }).toEqual({
				field,
				bare: false
			});
		}
	});
});
