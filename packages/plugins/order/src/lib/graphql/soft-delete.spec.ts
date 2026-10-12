/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the `DELETE /:id/soft`
 * and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all eleven resources of this
 * plugin serve that pair while not one of its resolvers declared either field. A client could therefore
 * retire an order, a frozen address, a change, an action, a credit line, a timeline entry, a line, a
 * line-to-invoice link, a delivery choice, a totals summary or a ledger row recoverably over REST and not
 * over GraphQL, where the only deletion-shaped field it held was a destructive one — and the destructive
 * one is exactly what the soft routes exist to avoid on rows that placed tax lines, issued invoices and a
 * money ledger point at. Twenty-two fields close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level view grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the services and the kernel's base controller.** The eleven controllers
 * are the real ones — including the `softRemove` and `softRecover` overrides, which exist only to state
 * the permission the inherited routes leave unstated — the four resolvers are the real ones, and the
 * document the fields are read out of is the real one. The service is the seam the parity requirement is
 * about: one stub is what makes "the same method with the same identifier" visible without a database
 * behind it, and every resource of this domain is written through one service of its own.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason the package's other suites
 * state — it boots the whole application graph, which no declaration here needs. The two pieces of it
 * this suite actually compares are the kernel's own: `@Permissions` is required from its own module,
 * because the metadata it writes is what "states the route's permission" means and a double that wrote
 * nothing would have the comparison pass on two absences; and the base controller's two lifecycle
 * handlers are restated in the shape `packages/core/src/lib/core/crud/crud.controller.ts` declares them,
 * handing the service the rest parameter as an ARRAY, because the real class reaches the entity graph.
 *
 * **The eight write routes beside the pair are held to the same three properties.** Five destructive
 * deletes — of the order, a frozen address, a change, one of a change's actions and a credit line — and
 * three updates — of a change, of one of its actions and of a credit line — answered no field at all.
 * They are not the withdrawals above: the pair keeps the row and these remove it, which is why both
 * halves are served. The audit that reads route handler names against field names reported thirty-six
 * candidates for this plugin, and the rest of them are mirrored under other names or served through the
 * change a caller raises and confirms; the table below states the eight that were genuinely unserved,
 * and the comment above it states where the other twenty-eight are answered.
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
		// The two routes this suite is about, in the shape the kernel declares them: the handler hands the
		// service its rest parameter, which is an empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRecover(id, options);
			}

			// The destructive route of the same base class, in the shape the kernel declares it: it hands
			// the service the identifier and nothing else, and what comes back is the driver's result
			// rather than the row.
			async delete(id: any): Promise<any> {
				return this.service.delete(id);
			}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		// The permission decorator is the kernel's own: what this suite compares between a route and the
		// field that mirrors it is the metadata it writes.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph. What the declarations
		// under test read is the metadata it writes, so that is what the double writes.
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
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		// The validation pipe the controllers build at class-definition time; Nest refuses a pipe with no
		// `transform`, and the controller files reach it through this barrel.
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

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderController } from '../order/order.controller';
import { OrderAddressController } from '../order-address/order-address.controller';
import { OrderChangeController } from '../order-change/order-change.controller';
import { OrderChangeActionController } from '../order-change-action/order-change-action.controller';
import { OrderCreditLineController } from '../order-credit-line/order-credit-line.controller';
import { OrderHistoryController } from '../order-history/order-history.controller';
import { OrderLineController } from '../order-line/order-line.controller';
import { OrderLineInvoiceController } from '../order-line-invoice/order-line-invoice.controller';
import { OrderShippingMethodController } from '../order-shipping-method/order-shipping-method.controller';
import { OrderSummaryController } from '../order-summary/order-summary.controller';
import { OrderTransactionController } from '../order-transaction/order-transaction.controller';
import { orderSchemaExtensions } from './schema-extensions';
import { OrderResolver } from './order.resolver';
import { OrderChangeResolver } from './order-change.resolver';
import { OrderLineInvoiceResolver } from './order-line-invoice.resolver';
import { OrderLineResolver } from './order-line.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires an order line over GraphQL and one
 * that retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/**
 * What the other two kinds of write answer with.
 *
 * A destructive delete cannot answer the row — the row is gone — so the driver's own result is what the
 * route hands back and what the field reads a count from; an update hands the ORM's result to the route,
 * while the field answers the row, because that is what the resource's sibling mutations answer.
 */
const DELETED = { affected: 1 };
const UPDATED = { id: ID, note: 'Bulk order' };

/**
 * What a handler declares about retrying it, and about the version it carries.
 *
 * Both are read off the declarations rather than restated: a route that adopted either convention has its
 * field compared against it, and a route that states neither is asserted to be mirrored by a field that
 * states neither.
 */
const { IDEMPOTENT_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
const { VERSIONED_METADATA_KEY, VERSION_EXPECTATION_PROPERTY } = jest.requireActual(
	'@gauzy/core/src/lib/concurrency/version.util'
);

const reflector = new Reflector();

/** What a handler declares about retrying it. */
const retryOf = (handler: any): any => reflector.get(IDEMPOTENT_METADATA_KEY, handler);

/** What a handler declares about the version it carries. */
const versionedOf = (handler: any): any => reflector.get(VERSIONED_METADATA_KEY, handler);

/**
 * The two surfaces of a versioned route, as the guard leaves them.
 *
 * A route declares the version its write is predicated on and the guard is what accepts it: it reads the
 * `If-Match` header, validates it against the row, and leaves the value on the request under
 * `VERSION_EXPECTATION_PROPERTY`. The GraphQL transport has no header to read, so a mutation states the
 * same value as a nullable argument and the resolver translates it into the same property on the same
 * request. This suite drives both shapes, which is what makes "the two call the service with the same
 * expectation" a comparison rather than a restatement.
 */
const EXPECTATION = { wildcard: false, versions: [3] };
const REQUEST: Row = { [VERSION_EXPECTATION_PROPERTY]: EXPECTATION };
const CONTEXT: Row = { req: REQUEST };

/**
 * The collaborators each resolver's constructor takes, in order, as this suite names them.
 *
 * A resource's pair is declared beside the fields that already serve it, which is not the same resolver
 * for all eleven: the order's own resolver carries the aggregates read through the order, the change's
 * carries the ledgers and the changes, and the register's carries the links. The list is stated once per
 * resolver so a constructor argument added later fails here rather than silently stubbing the service the
 * pair is supposed to reach.
 */
const RESOLVER_DEPS: Readonly<Record<string, readonly string[]>> = {
	OrderResolver: ['order', 'totals', 'line', 'address', 'shippingMethod', 'creditLine', 'history', 'change'],
	OrderChangeResolver: ['change', 'action', 'summary', 'transaction', 'history'],
	OrderLineInvoiceResolver: ['invoice', 'line'],
	OrderLineResolver: ['invoice', 'line']
};

/** One of the eleven resources, its two surfaces and the service that owns it. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The type its field answers with: the row, which is what its sibling mutations answer too. */
	answers: string;
	/** The collaborators its resolver takes, in constructor order. */
	deps: readonly string[];
	/** Which of those collaborators owns the resource. */
	service: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The eleven resources whose inherited lifecycle routes had no GraphQL counterpart.
 *
 * Every one of them states `ORDERS_EDIT` on both of its overrides — read off each controller rather than
 * assumed from the assignment — so every field below states the same grant, and the row is the type the
 * resource's sibling mutations already answer with.
 */
const RESOURCES: IResource[] = [
	{
		name: 'Order',
		answers: 'Order',
		deps: RESOLVER_DEPS.OrderResolver,
		service: 'order',
		controller: OrderController,
		resolver: OrderResolver
	},
	{
		name: 'OrderAddress',
		answers: 'OrderAddress',
		deps: RESOLVER_DEPS.OrderResolver,
		service: 'address',
		controller: OrderAddressController,
		resolver: OrderResolver
	},
	{
		name: 'OrderChange',
		answers: 'OrderChange',
		deps: RESOLVER_DEPS.OrderChangeResolver,
		service: 'change',
		controller: OrderChangeController,
		resolver: OrderChangeResolver
	},
	{
		name: 'OrderChangeAction',
		answers: 'OrderChangeAction',
		deps: RESOLVER_DEPS.OrderChangeResolver,
		service: 'action',
		controller: OrderChangeActionController,
		resolver: OrderChangeResolver
	},
	{
		name: 'OrderCreditLine',
		answers: 'OrderCreditLine',
		deps: RESOLVER_DEPS.OrderResolver,
		service: 'creditLine',
		controller: OrderCreditLineController,
		resolver: OrderResolver
	},
	{
		name: 'OrderHistory',
		answers: 'OrderHistory',
		deps: RESOLVER_DEPS.OrderChangeResolver,
		service: 'history',
		controller: OrderHistoryController,
		resolver: OrderChangeResolver
	},
	{
		name: 'OrderLine',
		answers: 'OrderLine',
		deps: RESOLVER_DEPS.OrderLineResolver,
		service: 'line',
		controller: OrderLineController,
		resolver: OrderLineResolver
	},
	{
		name: 'OrderLineInvoice',
		answers: 'OrderLineInvoice',
		deps: RESOLVER_DEPS.OrderLineInvoiceResolver,
		service: 'invoice',
		controller: OrderLineInvoiceController,
		resolver: OrderLineInvoiceResolver
	},
	{
		name: 'OrderShippingMethod',
		answers: 'OrderShippingMethod',
		deps: RESOLVER_DEPS.OrderResolver,
		service: 'shippingMethod',
		controller: OrderShippingMethodController,
		resolver: OrderResolver
	},
	{
		name: 'OrderSummary',
		answers: 'OrderSummary',
		deps: RESOLVER_DEPS.OrderChangeResolver,
		service: 'summary',
		controller: OrderSummaryController,
		resolver: OrderChangeResolver
	},
	{
		name: 'OrderTransaction',
		answers: 'OrderTransaction',
		deps: RESOLVER_DEPS.OrderChangeResolver,
		service: 'transaction',
		controller: OrderTransactionController,
		resolver: OrderChangeResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The twenty-two fields, built from the eleven resources so a resource cannot be listed with only half a
 * pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this
 * kind already use.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{ ...resource, field: `softDelete${resource.name}`, route: 'softRemove', method: 'softRemove' },
	{ ...resource, field: `recover${resource.name}`, route: 'softRecover', method: 'softRecover' }
]);

/**
 * One resource of the table above, by the name the domain gives it.
 *
 * The write routes below are declared over the same eleven resources, so the service each of them owns,
 * the resolver that carries its fields and the controller that serves its routes are stated once, above,
 * rather than a second time here.
 *
 * @param name The resource's name, as `RESOURCES` states it.
 * @returns The resource's entry.
 */
function resource(name: string): IResource {
	const found = RESOURCES.find((entry) => entry.name === name);

	if (!found) {
		throw new Error(`the suite declares no resource named "${name}"`);
	}

	return found;
}

/**
 * One write route of this domain that no field answered, and the field that now mirrors it.
 *
 * `route` is the handler the controller declares and `method` the service method both surfaces must
 * reach; they are the same word for seven of the eight and differ once, because the change's update
 * route reaches `commitChange` — the method that writes a change's columns under the version of the
 * order it belongs to — rather than the base class's `update`.
 */
interface IWrite {
	resource: IResource;
	field: string;
	route: string;
	method: string;
	/** The body the route takes, as its own DTO states it; the delete routes take none. */
	body?: Row;
	/** The type the field answers with. */
	answers: string;
}

/**
 * The eight write routes of this domain whose capability no field answered.
 *
 * Five of them are destructive deletes — of the order, a frozen address, a change, one of a change's
 * actions and a credit line — and three are updates: of a change, of one of its actions and of a credit
 * line. The five deletes are not the recoverable withdrawals beside them: the pair keeps the row, and
 * these remove it, which is why the plugin serves both halves rather than one standing in for the other.
 *
 * The rest of the audit's thirty-six are accounted for elsewhere: the six action routes of the order
 * controller and the two of the register are mirrored under other names (`place` and `placeOrder` were
 * the same pair), the child resources' creates and the line, delivery and address writes are served
 * through the change a caller raises and confirms, and the ledger, the timeline and the totals history
 * carry no update and no delete field at all, because `10-orders-payments-and-returns-spec.md` §4.2
 * states those rows are written by the writer that owns them and — for the ledger and the timeline —
 * never edited or deleted.
 */
const WRITES: IWrite[] = [
	{ resource: resource('Order'), field: 'deleteOrder', route: 'delete', method: 'delete', answers: 'OrderDeleteResult' },
	{
		resource: resource('OrderAddress'),
		field: 'deleteOrderAddress',
		route: 'delete',
		method: 'delete',
		answers: 'OrderDeleteResult'
	},
	{
		resource: resource('OrderChange'),
		field: 'updateOrderChange',
		route: 'update',
		method: 'commitChange',
		body: { note: 'Bulk order' },
		answers: 'OrderChange'
	},
	{
		resource: resource('OrderChange'),
		field: 'deleteOrderChange',
		route: 'delete',
		method: 'delete',
		answers: 'OrderDeleteResult'
	},
	{
		resource: resource('OrderChangeAction'),
		field: 'updateOrderChangeAction',
		route: 'update',
		method: 'update',
		body: { amount: 12.5 },
		answers: 'OrderChangeAction'
	},
	{
		resource: resource('OrderChangeAction'),
		field: 'deleteOrderChangeAction',
		route: 'delete',
		method: 'delete',
		answers: 'OrderDeleteResult'
	},
	{
		resource: resource('OrderCreditLine'),
		field: 'updateOrderCreditLine',
		route: 'update',
		method: 'update',
		body: { amount: 5 },
		answers: 'OrderCreditLine'
	},
	{
		resource: resource('OrderCreditLine'),
		field: 'deleteOrderCreditLine',
		route: 'delete',
		method: 'delete',
		answers: 'OrderDeleteResult'
	}
];

/** The grant every one of these routes states, which is what every field must state. */
const EDIT = ORDER_PERMISSIONS.ORDERS_EDIT;

/** The grant every one of these controllers states at class level, which no field may leave the act to. */
const VIEW = ORDER_PERMISSIONS.ORDERS_VIEW;

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * The other collaborators are stubbed as well — the resolvers take several — so a field that reached the
 * wrong one would be visible as an assertion about the wrong service rather than as a type error.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IResource): { service: Row; controller: Row; resolver: Row } {
	const stubs = new Map<string, Row>();

	for (const name of entry.deps) {
		if (!stubs.has(name)) {
			stubs.set(name, {
				softRemove: jest.fn().mockResolvedValue(RETIRED),
				softRecover: jest.fn().mockResolvedValue(RESTORED),
				// The three writes the routes below the pair reach: the destructive delete of the base
				// class, the update of a resource's own columns, and the change's own commit, which is the
				// update route that is predicated on the version of the order the row belongs to.
				delete: jest.fn().mockResolvedValue(DELETED),
				update: jest.fn().mockResolvedValue(UPDATED),
				findOneByIdString: jest.fn().mockResolvedValue(UPDATED),
				commitChange: jest.fn().mockResolvedValue(UPDATED)
			});
		}
	}

	const service = stubs.get(entry.service) as Row;

	return {
		service,
		// Every controller of this domain takes the resource's own service first and hands it to the base
		// class, which is what the two inherited routes call; the order controller's six other
		// collaborators belong to routes this pair does not touch.
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(...entry.deps.map((name) => stubs.get(name))) as Row
	};
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` (`shared/guards/permission.guard.ts`) then answers `true`
 * to when the pair is empty.
 *
 * @param controller The controller the route belongs to.
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
 */
function permissionOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, resolver)
	);
}

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = orderSchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the order document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the order document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The name of the type a field answers with, however deeply it is wrapped. */
function namedTypeOf(field: FieldDefinitionNode): string {
	return namedTypeName(field.type);
}

/**
 * The schema's half of the pair.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the order document — the eleven inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers the row each route answers, which is what the resource’s other mutations answer', () => {
		// The REST routes answer the row they retired or restored — the base class hands back what the
		// service returned — so the pair follows the resource's own type rather than a result object
		// invented for it.
		for (const { field, answers } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createOrder',
			'updateOrder',
			'cancelOrder',
			'archiveOrder',
			'placeOrder',
			'confirmOrder',
			'recalculateOrder',
			'requestOrderEdit',
			'confirmOrderChange',
			'declineOrderChange',
			'cancelOrderChange',
			'recordOrderLineInvoice',
			'updateOrderLineInvoice',
			'deleteOrderLineInvoice',
			'recomputeOrderLineInvoices',
			'recordOrderLineRefund'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is being corrected. A second spelling is a second vocabulary for one capability, and
		// a client that guessed the other one would find no field rather than an error it could act on.
		const restored = mutationFields()
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('restore'));

		expect(restored).toEqual([]);
		expect(mutationFields().map((field) => field.name.value)).toEqual(
			expect.arrayContaining(PARITY.filter(({ route }) => route === 'softRecover').map(({ field }) => field))
		);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the soft-delete pair — the two protocols retire and restore the same row', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](ID);
		const overGraphql = await resolver[entry.field](ID);

		// The inherited route hands over its rest parameter, which is an empty ARRAY, and the service
		// normalises both that and an absent argument to "no find options" — so the two are one call.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, []);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface acted on is the same row.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql).toBe(overRest);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes an order line, a ledger row or a
 * change out of every resolution and a recover puts it back into what an order's totals are read from —
 * so a field that left the grant to its class would extend the read permission into a write. That is the
 * defect the controllers' own overrides exist to close on the other surface, and the one a GraphQL caller
 * would otherwise reach it through.
 */
describe('the soft-delete pair — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			// The override is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the editing grant, which is the grant the twenty-two overrides state', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of every one of these controllers and resolvers is the VIEW grant, and a field
		// that left the act to its class would let a reader retire or restore an order and its satellites.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([EDIT]);
			expect(permissionOfRoute(controller, route)).toEqual([EDIT]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([VIEW]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([VIEW]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(OrderController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The schema's half of the write routes no field answered.
 *
 * The same three properties the pair is held to, for the eight fields beside it: each is declared with
 * the identifier its route takes and the body an update route takes, answers the row the resource's
 * siblings answer — or, for a delete, the identity that is left — and is declared beside the four types
 * it needs, so that a field a client cannot express fails here rather than at boot.
 */
describe('the order document — the write routes no field answered are declared', () => {
	it.each(WRITES)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier, the body an update route takes, and nothing else', () => {
		for (const { field, body } of WRITES) {
			const args = (mutationField(field).arguments ?? []).map((argument) => argument.name.value);

			expect(args[0]).toBe('id');
			expect(args.includes('input')).toBe(Boolean(body));
			// The change's update also states the version it is predicated on, as every mutation of that
			// resolver states it: a change has no version of its own, so the version is the order's.
			expect(args.filter((name) => !['id', 'input', 'version'].includes(name))).toEqual([]);
		}
	});

	it('answers the row an update answers, and the identity a delete has left', () => {
		for (const { field, answers } of WRITES) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('declares the result and the three inputs the fields are written against', () => {
		const declared = orderSchemaExtensions.definitions
			.filter(
				(definition) =>
					definition.kind === 'ObjectTypeDefinition' || definition.kind === 'InputObjectTypeDefinition'
			)
			.map((definition) => definition.name.value);

		for (const name of [
			'OrderDeleteResult',
			'UpdateOrderChangeInput',
			'UpdateOrderChangeActionInput',
			'UpdateOrderCreditLineInput'
		]) {
			expect(declared).toContain(name);
		}
	});
});

/**
 * The authorisation is the route's, field by field — and so is the version declaration where the route
 * states one.
 *
 * Three of the eight are updates of a row the order's totals were read from and five remove a row
 * outright, so a field that left the grant to its class would turn the read permission into a write on
 * both surfaces at once. The change's update route is the one of the eight that states `@Versioned({})`,
 * so its field states the same declaration and takes the version as the argument this resolver's other
 * change mutations take it as; none of the eight declares a retry scope, which is asserted rather than
 * assumed, because a keyless GraphQL retry would not dedupe where a REST route does.
 */
describe('the write routes — the permission, the guards and the version are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(WRITES.some(({ route, resource }) => permissionOfRoute(resource.controller, route))).toBe(true);

		for (const { field, route, resource } of WRITES) {
			// The declaration is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof handlersOf(resource.controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resource.resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(resource.controller)[route])
			);
			expect(permissionOfField(resource.resolver, field)).toEqual(
				permissionOfRoute(resource.controller, route)
			);
		}
	});

	it('demands the editing grant, which is the grant each of these routes states', () => {
		for (const { field, route, resource } of WRITES) {
			expect(permissionOfField(resource.resolver, field)).toEqual([EDIT]);
			expect(permissionOfRoute(resource.controller, route)).toEqual([EDIT]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, resource } of WRITES) {
			expect(guardsOf(resource.controller, route)).toEqual(
				expect.arrayContaining([TenantPermissionGuard, PermissionGuard])
			);
			expect(guardsOf(resource.resolver, field)).toEqual(
				expect.arrayContaining(guardsOf(resource.controller, route))
			);
		}
	});

	it('carries the versioned declaration the change update route states', () => {
		const route = versionedOf(OrderChangeController.prototype.update);

		// The control: the route states one, so the comparison below is not two absences agreeing.
		expect(route).toEqual({});
		expect(versionedOf(OrderChangeResolver.prototype.updateOrderChange)).toEqual(route);
	});

	it('states no retry scope, because none of these routes declares one', () => {
		for (const { field, route, resource } of WRITES) {
			expect(retryOf(handlersOf(resource.controller)[route])).toBeUndefined();
			expect(retryOf(fieldsOf(resource.resolver)[field])).toBeUndefined();
		}
	});
});

/**
 * One capability, two protocols, the same delegation — for the eight writes beside the pair.
 *
 * The route is driven as well as the field, so what is compared is the call each of them makes on one
 * stub rather than a service method named in this file. The update fields answer the row their resource's
 * siblings answer even though the route's own answer is the ORM's result, which is asserted as the second
 * call rather than hidden: a `PUT` that answered a bare `UpdateResult` over GraphQL would be a shape no
 * other field of this domain has.
 */
describe('the write routes — the two protocols write the same row', () => {
	it.each(WRITES.filter(({ body }) => Boolean(body)))(
		'$field reaches the service method the $route route reaches, with the same body',
		async (entry) => {
			const { service, controller, resolver } = surfaces(entry.resource);

			const overRest = await controller[entry.route](ID, entry.body, REQUEST);
			const overGraphql = await resolver[entry.field](ID, entry.body, EXPECTATION.versions[0], CONTEXT);
			const method = service[entry.method];

			expect(method).toHaveBeenCalledTimes(2);
			expect(method.mock.calls.map((call: Row[]) => call[0])).toEqual([ID, ID]);
			expect(method.mock.calls.map((call: Row[]) => call[1])).toEqual([entry.body, entry.body]);
			// Whatever either surface states beyond the body — the change route's version expectation — is
			// one value produced by one reader from the one the caller stated, so the two calls agree on it
			// argument for argument.
			expect(method.mock.calls[0].slice(2)).toEqual(method.mock.calls[1].slice(2));

			// The control for the comparison above: the one versioned route of the three really does hand
			// the expectation over, so the agreement is not two absences agreeing.
			if (entry.method === 'commitChange') {
				expect(method.mock.calls[1][2]).toEqual(EXPECTATION);
			} else {
				expect(method.mock.calls[1]).toHaveLength(2);
			}

			// The change's update answers the row through the service's own `commitChange`; the other two
			// read it back, which is the call below. Both answer the row, and the field answers it once.
			if (entry.method !== 'commitChange') {
				expect(service.findOneByIdString).toHaveBeenCalledWith(ID);
			}

			expect(overGraphql).toBe(UPDATED);
			expect(overGraphql).toBe(entry.method === 'commitChange' ? overRest : UPDATED);
		}
	);

	it.each(WRITES.filter(({ body }) => !body))(
		'$field reaches the service method the $route route reaches',
		async (entry) => {
			const { service, controller, resolver } = surfaces(entry.resource);

			const overRest = await controller[entry.route](ID);
			const overGraphql = await resolver[entry.field](ID);

			expect(service.delete).toHaveBeenCalledTimes(2);
			expect(service.delete.mock.calls.map((call: Row[]) => call[0])).toEqual([ID, ID]);

			// The route answers the driver's result; the field answers what a delete has left — the
			// identity it named and whether the row was there — which is the shape this domain's one
			// pre-existing delete field answers with.
			expect(overRest).toBe(DELETED);
			expect(overGraphql).toEqual({ id: ID, deleted: true });
		}
	);

	it('answers `deleted: false` when the row the delete named was not there', async () => {
		// The control for the count above: the field reports what the driver reported rather than a
		// constant, so a delete of a row that was already gone is distinguishable from one that removed it.
		const { service, resolver } = surfaces(resource('Order'));

		service.delete.mockResolvedValueOnce({ affected: 0 });

		expect(await resolver.deleteOrder(ID)).toEqual({ id: ID, deleted: false });
	});
});
