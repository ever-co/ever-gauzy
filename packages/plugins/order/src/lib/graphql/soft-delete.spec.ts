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
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const stubs = new Map<string, Row>();

	for (const name of entry.deps) {
		if (!stubs.has(name)) {
			stubs.set(name, {
				softRemove: jest.fn().mockResolvedValue(RETIRED),
				softRecover: jest.fn().mockResolvedValue(RESTORED)
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
