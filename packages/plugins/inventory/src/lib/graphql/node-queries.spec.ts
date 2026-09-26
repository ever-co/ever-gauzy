/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a GraphQL resolver needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the surfaces under test are the real ones**: the four controllers and the four
 * resolvers, bound to a stubbed service so what each of them delegates to is asserted rather than
 * inferred.
 *
 * The permission decorator is doubled with the platform's own metadata key, read from the platform's
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator's prose.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	// Read through `requireActual`, which bypasses this factory: the connection contract and the decimal
	// arithmetic are the kernel's, and a double would measure this file rather than the platform.
	const connection = jest.requireActual('@gauzy/core/src/lib/api/graphql-connection');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}
	}

	return {
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => 'typeorm',
		prepareSQLQuery: (sql: string) => sql,
		toPositionalStatement: (sql: string) => ({ sql, parameters: [] }),
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		parseIfMatch: () => undefined,
		commitVersionedUpdate: async () => ({}),
		versionExpectationOf: () => undefined,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		RolePermissionModule: class RolePermissionModule {},
		EventBusModule: class EventBusModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class the
		// resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UseValidationPipe: decorator,
		// The two conventions the decorated routes carry. Both are decorator factories and nothing more:
		// the guard and the interceptor they attach are application providers, and a unit test that never
		// boots the application never runs them.
		Versioned: () => () => undefined,
		Idempotent: () => () => undefined,
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		RequestContext: {
			currentRequest: () => null,
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		connectionFromOffsetPage: connection.connectionFromOffsetPage,
		resolveConnectionWindow: connection.resolveConnectionWindow,
		paginateRows: connection.paginateRows
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	})
);

import { print } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { InventoryPermission } from '../inventory.permissions';
import { StockAdjustmentController } from '../stock-adjustment/stock-adjustment.controller';
import { StockAlertController } from '../stock-alert/stock-alert.controller';
import { StockMovementController } from '../stock-movement/stock-movement.controller';
import { ChannelWarehouseController } from '../channel-warehouse/channel-warehouse.controller';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockAdjustmentResolver } from './stock-adjustment.resolver';
import { StockAlertResolver } from './stock-alert.resolver';
import { StockMovementResolver } from './stock-movement.resolver';
import { ChannelWarehouseResolver } from './channel-warehouse.resolver';

/**
 * The four `GET /:id` reads, on both surfaces (doc 17 §3.1).
 *
 * §3.1's first row is the read half of capability parity: *"A node query taking an `ID!`, returning the
 * same object graph the REST `GET /:id` returns for the same caller."* Four of this package's resources
 * — the adjustment, the alert rule, the ledger row and the channel assignment — serve that route and had
 * no node query, so a REST caller holding one row's identifier could read that row and a GraphQL caller
 * could not: the absence read as a client error rather than as a missing surface, because a root field
 * the schema does not declare is refused before any resolver is consulted.
 *
 * Four fields close it, and three properties are pinned for each:
 *
 * - it is **declared** on the query root of this package's contribution, with the `id: ID!` §3.1 names
 *   and the bare resource type the sibling node queries answer — bare rather than non-null, because a
 *   row that is not there is answered as the absence it is, not raised as a refusal;
 * - it **states the permission its own route runs under**, read from the route's metadata rather than
 *   restated here. Each of these four controllers *declares* its `GET /:id`, but none of those handlers
 *   states a permission of its own, so `PermissionGuard` resolves the pair `[handler, class]` through the
 *   reflector's `getAllAndOverride` and the controller's **class-level** `STOCK_VIEW` is what the route
 *   actually runs under. That is what the field states;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that read the same row through different calls are two behaviours waiting to diverge.
 */

type Row = Record<string, any>;

/** The row both surfaces read. Nothing reads it; it only has to be stated. */
const ID = '00000000-0000-4000-8000-000000000017';

/** One of the four resources whose `GET /:id` had no GraphQL counterpart. */
interface IResource {
	/** The resource, as this file names it in its assertions. */
	name: string;
	/** The root field the document declares for it. */
	field: string;
	/**
	 * The type its node query answers with — the row, which is what its connection's `nodes` carry and
	 * what its sibling node queries answer too.
	 */
	answers: string;
	/** The grant every read of this package runs under, which is the value the assertions look for. */
	grant: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the resolver over the stubbed service. */
	build: (service: any) => any;
	/** The row the stub answers with, so the two surfaces can be compared by identity. */
	row: Row;
}

/** The four resources, each with the route its field mirrors. */
const RESOURCES: IResource[] = [
	{
		name: 'StockAdjustment',
		field: 'stockAdjustment',
		answers: 'StockAdjustment',
		grant: InventoryPermission.STOCK_VIEW,
		controller: StockAdjustmentController,
		resolver: StockAdjustmentResolver,
		build: (service) => new StockAdjustmentResolver(service),
		row: { id: ID, number: 'ADJ-1', status: 'DRAFT' }
	},
	{
		name: 'StockAlert',
		field: 'stockAlert',
		answers: 'StockAlert',
		grant: InventoryPermission.STOCK_VIEW,
		controller: StockAlertController,
		resolver: StockAlertResolver,
		build: (service) => new StockAlertResolver(service),
		row: { id: ID, variantId: 'variant-1', threshold: 5, isActive: true }
	},
	{
		name: 'StockMovement',
		field: 'stockMovement',
		answers: 'StockMovement',
		grant: InventoryPermission.STOCK_VIEW,
		controller: StockMovementController,
		resolver: StockMovementResolver,
		build: (service) => new StockMovementResolver(service),
		row: { id: ID, variantId: 'variant-1', quantity: 3 }
	},
	{
		name: 'ChannelWarehouse',
		field: 'channelWarehouse',
		answers: 'ChannelWarehouse',
		grant: InventoryPermission.STOCK_VIEW,
		controller: ChannelWarehouseController,
		resolver: ChannelWarehouseResolver,
		build: (service) => new ChannelWarehouseResolver(service),
		row: { id: ID, channelId: 'channel-1', warehouseId: 'warehouse-1' }
	}
];

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * `findAll` is stubbed as well, so a field that read the connection instead of the node fails here
 * rather than passing on a coincidence.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IResource, row: Row | null = entry.row): { service: Row; controller: Row; resolver: Row } {
	const service = {
		findOneByIdString: jest.fn().mockResolvedValue(row),
		findAll: jest.fn().mockResolvedValue({ items: [], total: 0 })
	};

	return {
		service,
		controller: new entry.controller(service) as Row,
		resolver: entry.build(service)
	};
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
	const restated = handler ? (Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? []) : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The schema document, as a client reads it. */
const schemaText = print(inventorySchemaExtensions);

/**
 * The body of a root type's declaration, so a field can be asserted to sit on the root it belongs to.
 *
 * A `[\s\S]*` between two names is not the same question: every root field of this document follows its
 * query block, so a pattern spanning from the query root to a mutation's name matches whatever the
 * document declares in between. Reading the block is what makes "this read is offered as a query" a
 * statement about the query root rather than about the length of the document.
 *
 * @param name The root type.
 * @returns The text between its braces.
 */
function rootBody(name: string): string {
	const start = schemaText.search(new RegExp(`(?:extend\\s+)?type\\s+${name}\\b[^{]*\\{`));

	if (start === -1) {
		throw new Error(`the inventory document declares no root type named "${name}"`);
	}

	const open = schemaText.indexOf('{', start);
	let depth = 0;

	for (let index = open; index < schemaText.length; index++) {
		if (schemaText[index] === '{') depth++;
		else if (schemaText[index] === '}') {
			depth--;

			if (depth === 0) {
				return schemaText.slice(open + 1, index);
			}
		}
	}

	throw new Error(`the declaration of "${name}" is not brace-balanced`);
}

/**
 * The schema's half of the read.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and a document that does not build fails here rather than at boot.
 */
describe('the inventory document — the node queries are declared', () => {
	it.each(RESOURCES)('declares $field on the query root', ({ field }) => {
		expect(rootBody('Query')).toMatch(new RegExp(`(^|\\s)${field}\\(`));
	});

	it('takes the identifier each route takes, and nothing else', () => {
		// `id: ID!` — the argument §3.1 names, which is the one the route's own
		// `@Param('id', UUIDValidationPipe)` binds, and nothing else: a read names the row.
		for (const { field } of RESOURCES) {
			expect(rootBody('Query')).toMatch(new RegExp(`${field}\\(id: ID!\\)`));
		}
	});

	it('answers the row the resource is served as, nullable because a miss is an absence', () => {
		// The answer type is the one the resource's connection carries in its `nodes`, and it is stated
		// bare rather than non-null — which is how `stockReservation(id)`, `stockTransfer(id)` and
		// `stockCount(id)` beside them answer: a row that is not there is the absence it is, not a
		// refusal. The negative assertion is what makes the bareness a claim rather than a coincidence of
		// `toContain` matching a prefix.
		for (const { field, answers } of RESOURCES) {
			expect(rootBody('Query')).toContain(`${field}(id: ID!): ${answers}`);
			expect(rootBody('Query')).not.toContain(`${field}(id: ID!): ${answers}!`);
		}
	});

	it('offers none of them as a write', () => {
		// A node query on the mutation root would be a read a caller reaches through a write's door, and
		// the mutation block is where this document keeps the operations that change something.
		const mutation = rootBody('Mutation');

		for (const { field } of RESOURCES) {
			expect(mutation).not.toContain(`${field}(id: ID!):`);
		}
	});

	it('keeps every query the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const query = rootBody('Query');

		for (const field of [
			'stockLevels',
			'stockLevel',
			'availableQuantity',
			'stockMovements',
			'stockReservations',
			'stockReservation',
			'stockTransfers',
			'stockTransfer',
			'stockTransferLines',
			'stockTransferLine',
			'stockAlerts',
			'stockAdjustments',
			'stockCounts',
			'stockCount',
			'stockCountLines',
			'stockCountLine',
			'stockCountVariance',
			'channelWarehouses'
		]) {
			expect(query).toContain(`${field}(`);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one read stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the node queries — the two protocols read the same row', () => {
	it.each(RESOURCES)('$field reaches the service method its own route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		// The route is this controller's own handler — the four controllers declare their `GET /:id`
		// rather than inheriting it — so the read the field mirrors is the one written beside it.
		expect(Object.prototype.hasOwnProperty.call(handlersOf(entry.controller), 'findById')).toBe(true);

		const overRest = await controller['findById'](ID);
		const overGraphql = await resolver[entry.field](ID);

		// One method, two callers, and the same argument: the id.
		expect(service.findOneByIdString).toHaveBeenCalledTimes(2);
		expect(service.findOneByIdString.mock.calls.map((call) => call[0])).toEqual([ID, ID]);
		// The connection's read is not the seam this field crosses: the node query reads the row.
		expect(service.findAll).not.toHaveBeenCalled();
		// One answer, one implementation: the two protocols are not two ways of reading the same row.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(entry.row);
	});

	it.each(RESOURCES)('$field answers the absence of a row rather than refusing it', async (entry) => {
		// A miss is `null` on both surfaces. The field is declared nullable for this reason, and a
		// resolver that raised instead would turn "no such row is visible to you" into a transport
		// error — the sibling node queries of this package answer the same way.
		const { service, resolver } = surfaces(entry, null);

		await expect(resolver[entry.field](ID)).resolves.toBeNull();
		expect(service.findOneByIdString).toHaveBeenCalledWith(ID);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The read is a read on both surfaces, so what has to be true is that neither of them is wider than the
 * other: the field states the grant the route runs under, and a caller holding only some other grant is
 * refused here exactly as it is refused there.
 */
describe('the node queries — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route runs under, read from the route', () => {
		// A control first: the routes are gated, so the comparison below cannot pass on two absences.
		expect(RESOURCES.every(({ controller }) => permissionOfRoute(controller, 'findById'))).toBe(true);

		for (const { field, controller, resolver } of RESOURCES) {
			// These four handlers declare no permission of their own, which is the subtle half of the
			// row: the grant the route runs under is the *class-level* one, and it is the pair the guard
			// resolves that the field has to state.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)['findById'])).toBeUndefined();
			expect(permissionOfRoute(controller, 'findById')).toEqual([
				InventoryPermission.STOCK_VIEW as never
			]);

			// And the field states it, on its own handler, as every node query beside it does: no
			// resolver in this package declares a class-level grant that could stand in for it.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([
				InventoryPermission.STOCK_VIEW as never
			]);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, 'findById'));
		}
	});

	it('demands the read grant rather than a write grant, on every field', () => {
		// Stated explicitly as well as by comparison, because this is the value a reader will look for:
		// reading one row is a read, so a field that demanded `STOCK_EDIT` would refuse a caller the
		// route beside it answers.
		for (const { field, grant, resolver } of RESOURCES) {
			expect(grant).toBe(InventoryPermission.STOCK_VIEW);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, controller, resolver } of RESOURCES) {
			const routeGuards = guardsOf(controller, 'findById');

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(routeGuards));
		}
	});
});
