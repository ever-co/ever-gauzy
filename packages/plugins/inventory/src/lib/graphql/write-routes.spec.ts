/**
 * The write routes this package answered under another name, and the three it did not answer at all.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **five** of this package's twenty-eight
 * write routes — which is not a gap count, because the instrument is name-blind in both directions that
 * matter here:
 *
 * - **two routes it did not flag at all**, because they were matched against *another resource's* field.
 *   `StockAdjustmentController.cancel` and `StockCountController.cancel` carry the verb `cancel`, and the
 *   instrument looks for a field whose name holds that verb and the first five characters of the resource
 *   — `stock` — which `cancelStockTransfer` satisfies for both. The match is silent: the two routes were
 *   reported as answered by a field that writes a stock *transfer*. The strict variant of the same
 *   instrument, which requires the field to name the whole resource, flags them; the loose one does not,
 *   and that difference is the only difference between the two scripts.
 * - **two routes it flags that a field does answer**: `POST /stock-adjustments` is served by `adjustStock`
 *   and `POST /stock-transfer-lines` by `addStockTransferLine`. Neither field carries its route's handler
 *   name contiguously, which is all the instrument measures.
 *
 * Five plus two is **seven**, which is what the strict instrument reports, and the reading collapses
 * **two** of them — the two naming variants — leaving **five**: the three this suite delivers and the two
 * it refuses. They are not all of one shape.
 *
 * **The three delivered.** Each is a capability a REST caller has and a GraphQL caller did not:
 *
 * - `cancelStockAdjustment` — `POST /stock-adjustments/:id/cancel`. The counterpart of the
 *   `applyStockAdjustment` this document already carries: an apply writes the correction's ledger row, a
 *   cancel closes the instruction without writing anything.
 * - `cancelStockCount` — `POST /stock-counts/:id/cancel`. The domain states this route in the same row as
 *   the open, the count and the close (`09-inventory-and-fulfillment-spec.md` §14.12), so it is a
 *   capability the specification names rather than one inferred from a handler.
 * - `extendStockReservation` — `POST /stock-reservations/:id/extend`, stated twice over: the API
 *   specification's own inventory table (`06-api-specification.md` §7.8) and the domain's surface table
 *   (`09` §11.1, which fixes the body as `{ expiresAt }` and the grant as `STOCK_EDIT`). The field
 *   mirrors the argument order the route actually calls with — the service takes the *kind* before the
 *   *document* — which is the trap this route sets for anyone reading its path.
 *
 * **The two refused, and why the refusal is a reading rather than a gap.** Both routes exist and both
 * write; mirroring either would contradict a specification:
 *
 * - `POST /stock-reservations/expire` runs the reservation-expiry sweep **inline** and answers `200` with
 *   a count. `09` §16.5 states the capability as a worker job: *"Alerts, reconciliation, expiry, wave
 *   planning proposals, the replenishment scan, the cycle-count plan and manifest drafting are all worker
 *   jobs (`inventory-reconciliation`, `reservation-expiry`, …). The API enqueues and returns `202`; it
 *   never performs a long scan inline."* A mutation would put an inline scan the specification forbids
 *   into the schema, and would tell a generated client that a per-tenant sweep is an authoring act.
 *   **Counter-evidence, stated rather than hidden:** the sibling sweep `POST /stock-levels/reconcile` *is*
 *   mirrored, by `reconcileStockLevels`, and `06` §7.8 gives that route a `202` and a `STOCK_RECONCILE`
 *   operation. If §16.5 is read as descriptive rather than prohibitive, this route is a genuine gap.
 * - `POST /stock-reservations/:id` reaches the CRUD base's generic `update` with a `PartialType` of the
 *   whole create shape, so a caller can rewrite a live hold's `quantity`, `status`, `variantId` or
 *   `warehouseId` with no level write and no movement. `09` §15.1 states the invariant that forbids it —
 *   *"`L.reservedQuantity = Σ stock_reservation.quantity WHERE status = 'ACTIVE'` … enforced by
 *   `reserve`/`release`/`consume`/`releaseExpired` write the reservation row and the movement in one
 *   transaction"* — and `StockReservationService` declares no `update` of its own, so there is no domain
 *   method for a field to reach. Mirroring it would add a fifth writer of the reservation row to a
 *   protocol that has no way to write the movement beside it. **This is reported as a live REST hole and
 *   left open**: closing it means narrowing a published DTO or removing a route, which is the owner's
 *   call, not a wave's.
 *
 * Three properties are pinned for each delivered field: it is **declared** in this plugin's document with
 * the arguments the route takes; it **states its own route's permission**, read from the route's metadata
 * rather than restated here, because `PermissionGuard` resolves handler-then-class and the class grant of
 * every one of these controllers is the view grant none of these acts carries; and it **reaches the same
 * service call with the same arguments the route reaches**, because two protocols that perform one act
 * differently are two behaviours waiting to diverge — and it mirrors the route's `@Idempotent` scope and
 * `@Versioned` expectation where the route declares one, which none of these three does.
 *
 * **The collapsed routes are asserted rather than described**, so the reading is a test and not a
 * paragraph: for each one the name the audit looked for is declared *absent* from the document, and the
 * field that serves the capability is declared *present*. **Nothing is doubled here but the services.**
 * The controllers are the real ones, the resolvers are the real ones, `CrudController` behind them is the
 * kernel's own where a controller extends it, and the document the fields are read out of is the real one.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	EventBus,
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import {
	FieldDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { InventoryPermission } from './../inventory.permissions';
import { StockAdjustmentController } from './../stock-adjustment/stock-adjustment.controller';
import { StockCountController } from './../stock-count/stock-count.controller';
import { StockReservationController } from './../stock-reservation/stock-reservation.controller';
import { StockTransferLineController } from './../stock-transfer-line/stock-transfer-line.controller';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockAdjustmentResolver } from './stock-adjustment.resolver';
import { StockCountResolver } from './stock-count.resolver';
import { StockReservationResolver } from './stock-reservation.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ADJUSTMENT = '00000000-0000-4000-8000-000000000101';
const COUNT = '00000000-0000-4000-8000-000000000102';
const DOCUMENT = '00000000-0000-4000-8000-000000000103';
const EXPIRES_AT = '2026-04-01T00:00:00.000Z';

/** What each service answers, so the two surfaces can be compared by identity. */
const ADJUSTMENT_ROW = { id: ADJUSTMENT, status: 'CANCELED', quantity: 3 };
const COUNT_ROW = { id: COUNT, status: 'CANCELED', countedLineCount: 0 };
const EXTENDED = 2;

/**
 * The stub that owns each capability, which is the service the field must reach.
 *
 * Every stub carries every method under test rather than only its own, so a field that reached the wrong
 * service is visible as an assertion about the wrong stub instead of as a comparison that passes.
 */
type ServiceKey = 'adjustment' | 'count' | 'reservation';

/** One delivered route, its two surfaces, and what its field must mirror. */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit's convention expected, which for these three is the delivered name. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: PermissionsEnum;
	/** The method both surfaces must reach. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The three routes no field answered.
 *
 * Each is a capability rather than a spare route: an instruction that can be withdrawn before it is
 * applied, a count session that can be refused, and the holds of a document whose expiry can be pushed
 * out in one call.
 */
const DELIVERED: IParity[] = [
	{
		field: 'cancelStockAdjustment',
		route: 'cancel',
		resource: 'StockAdjustment',
		expects: 'cancelStockAdjustment',
		routeArgs: [ADJUSTMENT],
		fieldArgs: [ADJUSTMENT],
		serviceArgs: [ADJUSTMENT],
		declared: [['id', 'ID']],
		answers: 'StockAdjustment',
		grant: InventoryPermission.STOCK_EDIT as PermissionsEnum,
		method: 'cancel',
		service: 'adjustment',
		controller: StockAdjustmentController,
		resolver: StockAdjustmentResolver
	},
	{
		field: 'cancelStockCount',
		route: 'cancel',
		resource: 'StockCount',
		expects: 'cancelStockCount',
		routeArgs: [COUNT],
		fieldArgs: [COUNT],
		serviceArgs: [COUNT],
		declared: [['id', 'ID']],
		answers: 'StockCount',
		grant: InventoryPermission.STOCK_EDIT as PermissionsEnum,
		method: 'cancel',
		service: 'count',
		controller: StockCountController,
		resolver: StockCountResolver
	},
	{
		field: 'extendStockReservation',
		route: 'extend',
		resource: 'StockReservation',
		expects: 'extendStockReservation',
		// The route's path member is the document and its query members are the instant and the optional
		// kind; the field states the same three, in the same order.
		routeArgs: [DOCUMENT, EXPIRES_AT, 'ORDER'],
		fieldArgs: [DOCUMENT, EXPIRES_AT, 'ORDER'],
		// The *service* takes the kind first and the document second — the order this route's own call
		// uses, and the one a reader of the path alone gets wrong.
		serviceArgs: ['ORDER', DOCUMENT, new Date(EXPIRES_AT)],
		declared: [
			['id', 'ID'],
			['expiresAt', 'DateTime'],
			['referenceType', 'String']
		],
		answers: 'Int',
		grant: InventoryPermission.STOCK_EDIT as PermissionsEnum,
		method: 'extend',
		service: 'reservation',
		controller: StockReservationController,
		resolver: StockReservationResolver
	}
];

/**
 * The two routes the reading collapsed, each with the field that already serves it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is — the
 * audit's expectation for each is asserted absent below, so this table fails if a future wave renames one
 * of the serving fields out from under the routes that name it in their own docstrings.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	field: string;
}[] = [
	// A manual correction: drafted by the field whose name says what the act is rather than repeating the
	// resource, because `adjustStock` reads as the operation and `createStockAdjustment` as a second
	// spelling of the resource the type already names.
	{
		controller: StockAdjustmentController,
		resource: 'StockAdjustment',
		route: 'create',
		expects: 'createStockAdjustment',
		field: 'adjustStock'
	},
	// A line of a draft transfer: added through the field named for the act, beside the transfer's own
	// create, update and transitions.
	{
		controller: StockTransferLineController,
		resource: 'StockTransferLine',
		route: 'create',
		expects: 'createStockTransferLine',
		field: 'addStockTransferLine'
	}
];

/**
 * The two routes that exist, write, and are deliberately not mirrored.
 *
 * They are listed with the route whose handler serves them so the assertion below can check that the
 * route is real: a refusal is a statement about a surface, and a surface that does not serve the route
 * would make the refusal vacuous.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** Every name a convention could have given the field, all of which must be absent. */
	names: string[];
	/** Why mirroring it would contradict a specification, in one line. */
	because: string;
}[] = [
	{
		controller: StockReservationController,
		resource: 'StockReservation',
		route: 'expire',
		names: ['expireStockReservation', 'expireStockReservations', 'releaseExpiredStockReservations'],
		because: '09 §16.5 makes the expiry sweep a worker job the API enqueues, never an inline scan'
	},
	{
		controller: StockReservationController,
		resource: 'StockReservation',
		route: 'update',
		names: ['updateStockReservation'],
		because: '09 §15.1 INV-03 admits only reserve/release/consume/releaseExpired as writers of a hold'
	}
];

/**
 * The two surfaces over the stubs that own them.
 *
 * One stub per resource, and every stub carries every method under test: the reservation resolver holds
 * one service, but the adjustment and count resolvers hold services whose `cancel` a field could reach by
 * mistake, so both are stubbed on every object.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		adjustment: {
			cancel: jest.fn().mockResolvedValue(ADJUSTMENT_ROW),
			extend: jest.fn().mockResolvedValue(EXTENDED),
			apply: jest.fn().mockResolvedValue({ adjustment: ADJUSTMENT_ROW, version: 1 })
		},
		count: {
			cancel: jest.fn().mockResolvedValue(COUNT_ROW),
			extend: jest.fn().mockResolvedValue(EXTENDED),
			close: jest.fn().mockResolvedValue({ count: COUNT_ROW, lines: [] })
		},
		reservation: {
			cancel: jest.fn().mockResolvedValue(undefined),
			extend: jest.fn().mockResolvedValue(EXTENDED),
			consume: jest.fn().mockResolvedValue(undefined)
		}
	};

	const controller =
		entry.service === 'adjustment'
			? new StockAdjustmentController(stubs.adjustment)
			: entry.service === 'count'
				? new StockCountController(stubs.count)
				: new StockReservationController(stubs.reservation);

	const resolver =
		entry.service === 'adjustment'
			? new StockAdjustmentResolver(stubs.adjustment)
			: entry.service === 'count'
				? new StockCountResolver(stubs.count)
				: new StockReservationResolver(stubs.reservation, { ofType: () => null } as unknown as EventBus);

	return { stubs, controller: controller as Row, resolver: resolver as Row };
}

/** The handlers of one controller, as functions. */
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
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
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
	const restated = handler ? (Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? []) : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = inventorySchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the inventory document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the inventory document declares no Mutation field named "${name}"`);
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

/**
 * The schema's half of the three fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the inventory document — the three routes no field answered are declared', () => {
	it.each(DELIVERED)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of DELIVERED) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [name, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
				// The two identifiers and the instant are non-null and the kind is nullable, exactly as the
				// route states them: `expiresAt` is a required query member, `referenceType` is optional.
				expect(arguments_[index].type.kind).toBe(name === 'referenceType' ? 'NamedType' : 'NonNullType');
			}
		}
	});

	it('answers the row each route answers', () => {
		for (const { field, answers } of DELIVERED) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'reconcileStockLevels',
			'adjustStock',
			'applyStockAdjustment',
			'createStockReservation',
			'releaseStockReservation',
			'consumeStockReservation',
			'createStockTransfer',
			'updateStockTransfer',
			'requestStockTransfer',
			'approveStockTransfer',
			'shipStockTransfer',
			'receiveStockTransfer',
			'cancelStockTransfer',
			'addStockTransferLine',
			'createStockAlert',
			'updateStockAlert',
			'deleteStockAlert',
			'createStockCount',
			'openStockCount',
			'recordStockCountLine',
			'closeStockCount',
			'assignChannelWarehouse',
			'unassignChannelWarehouse'
		]) {
			expect(declares(name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the three fields — the two protocols write the same rows the same way', () => {
	it.each(DELIVERED)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order — which for `extendStockReservation` is
		// the order the *service* takes, not the order the route's path suggests.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		expect(overGraphql).toBe(overRest);
	});

	it.each(DELIVERED)('$field writes through its own service and not a sibling’s', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		for (const [name, stub] of Object.entries(stubs)) {
			expect(stub[entry.method]).toHaveBeenCalledTimes(name === entry.service ? 2 : 0);
		}
	});

	it('refuses an instant neither surface can read, before either reaches the service', async () => {
		// The route validates the expiry rather than passing it through, because a hold whose `expiresAt`
		// is an invalid date is one the expiry sweep can never select. The field states the same refusal
		// with the same code, and neither surface writes anything first.
		const { stubs, controller, resolver } = surfaces(DELIVERED[2]);

		await expect(controller.extend(DOCUMENT, 'later today', 'ORDER')).rejects.toThrow(
			/STOCK_RESERVATION_EXPIRY_INVALID/
		);
		await expect(resolver.extendStockReservation(DOCUMENT, 'later today', 'ORDER')).rejects.toThrow(
			/STOCK_RESERVATION_EXPIRY_INVALID/
		);

		expect(stubs.reservation.extend).not.toHaveBeenCalled();
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the three is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could close a
 * correction, refuse a count or push out every hold of a document. No resolver in this plugin states a
 * class-level grant that could close that — all three state the view grant — which is why the comparison
 * is against the route's own handler metadata rather than against the class.
 */
describe('the three fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are gated, so the comparison below cannot pass on two absences.
		expect(DELIVERED.every(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of DELIVERED) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of DELIVERED) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and the class grant of each of these
			// resolvers is the *view* grant, which is not what any of these acts carries.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// None of the three routes carries `@Idempotent` or `@Versioned`, so neither does any of the three
		// fields: a keyless GraphQL retry must not dedupe where REST does not, and a version expectation
		// invented here would refuse writes the route accepts. The count's *cancel* is the case the domain
		// states explicitly — its list of the actions that honour an `Idempotency-Key` omits it — and the
		// adjustment's cancel is idempotent by the row's own status instead.
		for (const { field, route, controller, resolver } of DELIVERED) {
			for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
				expect(Reflect.getMetadata(key, fieldsOf(resolver)[field])).toBeUndefined();
				expect(Reflect.getMetadata(key, handlersOf(controller)[route])).toBeUndefined();
			}
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of DELIVERED) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the strict instrument flagged and this suite does not implement is pinned here: either the
 * name it looked for is absent from the document while the field that serves the capability is present, or
 * the route is one of the two this suite refuses with its reason.
 */
describe('the seven flagged routes — two collapsed, three delivered, two refused', () => {
	it('flags seven routes strictly and five loosely, collapses two and delivers three', () => {
		expect(COLLAPSED).toHaveLength(2);
		expect(DELIVERED).toHaveLength(3);
		expect(REFUSED).toHaveLength(2);

		// The arithmetic the two instruments state: the strict one flags seven, the loose one five, and
		// the difference is the two `cancel` routes it matched against `cancelStockTransfer`. Two of the
		// seven are naming variants, three are delivered and two are refused.
		expect(COLLAPSED.length + DELIVERED.length + REFUSED.length).toBe(7);
		expect(7 - COLLAPSED.length).toBe(5);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field', ({ controller, route, expects, field }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the
		// surface rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — the name it built from the handler and the resource is not a
		// field — while the capability is answered by the field the table names.
		expect(declares(expects)).toBe(false);
		expect(declares(field)).toBe(true);
	});

	it.each(REFUSED)('$resource.$route is deliberately not mirrored: $because', ({ controller, route, names }) => {
		// The route is real, so the refusal is a statement about the surface rather than about a handler
		// that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// No field serves it, under any name a convention could have given it.
		for (const name of names) {
			expect(declares(name)).toBe(false);
		}
	});

	it('answers the two cancel routes under the names their resources own, and not another resource’s', () => {
		// The two false matches, asserted: the loose instrument concluded that `cancelStockTransfer`
		// answered both `cancel` routes, which is a field of a different resource. The transfer's own
		// cancel stays as it was — it is the transfer's transition, not the adjustment's or the count's.
		expect(declares('cancelStockAdjustment')).toBe(true);
		expect(declares('cancelStockCount')).toBe(true);
		expect(declares('cancelStockTransfer')).toBe(true);
		expect(declares('createStockAdjustment')).toBe(false);
		expect(declares('createStockTransferLine')).toBe(false);
		expect(declares('adjustStock')).toBe(true);
		expect(declares('addStockTransferLine')).toBe(true);
	});
});
