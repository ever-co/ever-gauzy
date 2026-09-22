/**
 * The inventory list surface, against the platform's one connection contract.
 *
 * A list root field answers a connection — `nodes`, `edges`, `totalCount` and a non-null `pageInfo` —
 * and the page is read in the store from the two numbers the cursor protocol resolves to. Both halves
 * are pinned here, because both can fail quietly:
 *
 * - a field that still returns `[T!]!` is a field a client cannot page, and a canonical connection
 *   type declared beside it does not make it pageable: the assertion below reads the field's own
 *   signature, not the types around it;
 * - a field that states a row offset to a read that interprets it as a page *number* answers the
 *   wrong page — a walk that repeats rows and skips others, with nothing red anywhere — so what the
 *   resolver hands the service is asserted, not inferred.
 *
 * **The kernel's helpers are the real ones in the double below.** `resolveConnectionWindow` decides
 * the window, the caps and the refusals, and a hand-written stand-in here would let this suite agree
 * with itself about arithmetic the platform does not perform. `@gauzy/core` itself is doubled at the
 * module boundary, as every suite in this package doubles it: its barrel boots the whole application
 * graph — configuration, the ORM, the job registry — none of which a resolver needs, and its nested
 * `uuid` is ESM-only.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	// Read through `requireActual`, which bypasses this factory: the connection contract is what the
	// assertions below are about, so it has to be the kernel's own implementation.
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
		// The real decimal arithmetic, for the same reason the connection helpers are real: a service in
		// this package's import graph sums quantities exactly, and a double that rounded would hide it.
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
	}),
	{ virtual: true }
);

import { print } from 'graphql';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockMovementResolver } from './stock-movement.resolver';
import { StockReservationResolver } from './stock-reservation.resolver';
import { StockTransferResolver } from './stock-transfer.resolver';
import { StockTransferLineResolver } from './stock-transfer-line.resolver';
import { StockAlertResolver } from './stock-alert.resolver';
import { StockAdjustmentResolver } from './stock-adjustment.resolver';
import { StockCountResolver } from './stock-count.resolver';
import { StockCountLineResolver } from './stock-count-line.resolver';
import { ChannelWarehouseResolver } from './channel-warehouse.resolver';

/** The identifiers the filtered fields are asked about. Nothing reads them; they only have to be stated. */
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const REFERENCE = '00000000-0000-4000-8000-000000000040';
const TRANSFER = '00000000-0000-4000-8000-000000000050';
const COUNT = '00000000-0000-4000-8000-000000000060';
const CHANNEL = '00000000-0000-4000-8000-000000000070';

/** The connection a resolver answers with, as much of it as these assertions read. */
interface IConnection {
	readonly nodes: readonly { readonly id: string }[];
	readonly edges: readonly { readonly node: { readonly id: string }; readonly cursor: string }[];
	readonly totalCount: number;
	readonly pageInfo: {
		readonly hasNextPage: boolean;
		readonly hasPreviousPage: boolean;
		readonly startCursor: string | null;
		readonly endCursor: string | null;
	};
}

/** One converted root field, and everything needed to drive it over a stubbed service. */
interface IFieldCase {
	/** The root field, as the SDL spells it. */
	readonly field: string;
	/** The resource it is about, which names its connection type and its edge type. */
	readonly resource: string;
	/** Builds the resolver over a service stub and an event-bus stub. */
	readonly build: (service: any, eventBus: any) => any;
	/** Calls the field's resolver method with the page the caller stated, and the soft-delete flag. */
	readonly call: (resolver: any, page?: any, withDeleted?: boolean) => Promise<IConnection>;
	/** The filter the resolver must state to the service. */
	readonly where: Record<string, unknown>;
	/** The order the resource's own read means, when it states one. */
	readonly order?: Record<string, unknown>;
	/** Whether the field offers `withDeleted`, which the read it delegates to carries into the store. */
	readonly withDeleted?: boolean;
}

/**
 * The nine list root fields whose read is the ordinary `findAll`, each with the read it delegates to.
 *
 * `stockLevels` is covered beside them by the SDL assertion below rather than by a case here: it answers from
 * the service's own paged read, which is a query builder rather than `findAll`, so the stub that drives these
 * nine would be the wrong instrument for it.
 *
 * `withDeleted` is stated per case rather than assumed: it is declared by the fields whose read hands its
 * options to `findAll`, and `stockReservations` — the platform's own field rather than this wave's — does
 * not declare it. Asserting one shape for both would either read a declaration that is not there or stop
 * reading the ones that are.
 */
const CASES: IFieldCase[] = [
	{
		field: 'stockMovements',
		resource: 'StockMovement',
		build: (service, eventBus) => new StockMovementResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.stockMovements(WAREHOUSE, VARIANT, page, withDeleted),
		where: { warehouseId: WAREHOUSE, variantId: VARIANT },
		order: { occurredAt: 'DESC' },
		withDeleted: true
	},
	{
		field: 'stockReservations',
		resource: 'StockReservation',
		build: (service, eventBus) => new StockReservationResolver(service, eventBus),
		call: (resolver, page) => resolver.stockReservations('ORDER' as never, REFERENCE, 'ACTIVE' as never, page),
		where: { referenceType: 'ORDER', referenceId: REFERENCE, status: 'ACTIVE' }
	},
	{
		field: 'stockTransfers',
		resource: 'StockTransfer',
		build: (service, eventBus) => new StockTransferResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.stockTransfers('DRAFT' as never, page, withDeleted),
		where: { status: 'DRAFT' },
		withDeleted: true
	},
	{
		field: 'stockTransferLines',
		resource: 'StockTransferLine',
		build: (service, eventBus) => new StockTransferLineResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.stockTransferLines(TRANSFER, page, withDeleted),
		where: { transferId: TRANSFER },
		withDeleted: true
	},
	{
		field: 'stockAlerts',
		resource: 'StockAlert',
		build: (service, eventBus) => new StockAlertResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.stockAlerts(VARIANT, true, page, withDeleted),
		where: { variantId: VARIANT, isActive: true },
		withDeleted: true
	},
	{
		field: 'stockAdjustments',
		resource: 'StockAdjustment',
		build: (service, eventBus) => new StockAdjustmentResolver(service, eventBus),
		call: (resolver, page, withDeleted) =>
			resolver.stockAdjustments(WAREHOUSE, VARIANT, 'DRAFT' as never, page, withDeleted),
		where: { warehouseId: WAREHOUSE, variantId: VARIANT, status: 'DRAFT' },
		withDeleted: true
	},
	{
		field: 'stockCounts',
		resource: 'StockCount',
		build: (service, eventBus) => new StockCountResolver(service, eventBus),
		call: (resolver, page, withDeleted) =>
			resolver.stockCounts(WAREHOUSE, 'OPEN' as never, 'FULL' as never, page, withDeleted),
		where: { warehouseId: WAREHOUSE, status: 'OPEN', mode: 'FULL' },
		withDeleted: true
	},
	{
		field: 'stockCountLines',
		resource: 'StockCountLine',
		build: (service, eventBus) => new StockCountLineResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.stockCountLines(COUNT, page, withDeleted),
		where: { stockCountId: COUNT },
		withDeleted: true
	},
	{
		field: 'channelWarehouses',
		resource: 'ChannelWarehouse',
		build: (service, eventBus) => new ChannelWarehouseResolver(service, eventBus),
		call: (resolver, page, withDeleted) => resolver.channelWarehouses(CHANNEL, WAREHOUSE, page, withDeleted),
		where: { channelId: CHANNEL, warehouseId: WAREHOUSE },
		withDeleted: true
	}
];

/** The schema document, as a client reads it. */
const schemaText = print(inventorySchemaExtensions);

/**
 * The same document with descriptions removed.
 *
 * A description's lines are indented like a member's, so reading members without stripping them first
 * reads prose as a field — the mistake every gate in `tools/` documents having made once.
 */
const described = schemaText.replace(/"""(?:[\s\S]*?)"""/g, '').replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '');

/**
 * @param name The type.
 * @returns The body of `type <name> { … }`, or null when the document declares no such type.
 */
function typeBody(name: string): string | null {
	const start = described.search(new RegExp(`^type\\s+${name}\\b[^{]*\\{`, 'm'));

	if (start === -1) {
		return null;
	}

	const open = described.indexOf('{', start);
	let depth = 0;

	for (let index = open; index < described.length; index++) {
		if (described[index] === '{') depth++;
		else if (described[index] === '}') {
			depth--;

			if (depth === 0) {
				return described.slice(open + 1, index);
			}
		}
	}

	return null;
}

/** A service stub that answers one page. Only `findAll` exists, so a resolver reading any other seam fails loudly. */
function serviceStub(items: { id: string }[], total = items.length) {
	return { findAll: jest.fn().mockResolvedValue({ items, total }) };
}

/** An event bus stub: none of the list fields subscribes, but the resolvers take one. */
const eventBusStub = { ofType: () => ({ pipe: () => null }) };

describe('the inventory list surface answers the connection contract', () => {
	it('declares a canonical connection, and its edge, for every converted list field', () => {
		for (const testCase of CASES) {
			const connection = `${testCase.resource}Connection`;
			const edge = `${testCase.resource}Edge`;

			// The field states its page one way and answers a connection: a caller can walk it, and the
			// page size is not stated twice — `take` beside `page` would be two spellings of one thing, and
			// nothing would say which of them wins. `withDeleted` is asserted where the field declares it,
			// and its absence is asserted where it does not: a field that gained the argument without the
			// read behind it is the one failure this pair of assertions is here to catch.
			const declared = `page: PageInput${testCase.withDeleted ? ', withDeleted: Boolean' : ''}`;

			expect(described).toMatch(new RegExp(`${testCase.field}\\([^)]*${declared}\\): ${connection}!`));
			expect(described).not.toMatch(new RegExp(`${testCase.field}\\([^)]*take: Int`));

			// The connection is the canonical shape — the same four members every other connection in the
			// platform declares — and its `edges` name the edge type beside it.
			const connectionBody = typeBody(connection);

			expect(connectionBody).not.toBeNull();
			expect(connectionBody).toContain('nodes: [');
			expect(connectionBody).toContain(`edges: [${edge}!]!`);
			expect(connectionBody).toContain('totalCount: Int!');
			expect(connectionBody).toContain('pageInfo: PageInfo!');

			// An edge carries the row and the cursor that addresses it — the two members every edge in the
			// platform declares.
			const edgeBody = typeBody(edge);

			expect(edgeBody).not.toBeNull();
			expect(edgeBody).toContain(`node: ${testCase.resource}!`);
			expect(edgeBody).toContain('cursor: String!');
		}

		// `stockLevels` is a connection too, and it is pinned here rather than in the loop above because its
		// read is the service's own query builder rather than `findAll`. It was the last list field holding
		// out, on the grounds that its read answered neither a window nor a count; both exist now, so the
		// exemption it used to carry is gone rather than merely unasserted.
		expect(described).toMatch(
			/stockLevels\(warehouseId: ID, variantId: ID, page: PageInput, withDeleted: Boolean\): StockLevelConnection!/
		);
		expect(typeBody('StockLevelConnection')).toContain('nodes: [StockLevel!]!');
		expect(typeBody('StockLevelConnection')).toContain('edges: [StockLevelEdge!]!');
		expect(typeBody('StockLevelEdge')).toContain('cursor: String!');
		expect(described).not.toMatch(/stockLevels\([^)]*take: Int/);
	});

	it('offers the retired rows its read can reach, and leaves an unflagged read exactly as it was', async () => {
		for (const testCase of CASES.filter((entry) => entry.withDeleted)) {
			// The flag travels into the read's own options: an argument the read drops is worse than a
			// missing one, because the client is told it can ask and is answered the same rows either way.
			const asked = serviceStub([], 0);
			await testCase.call(testCase.build(asked, eventBusStub), { first: 2 }, true);

			expect(asked.findAll).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));

			// And a caller that asked for nothing hands the read no `withDeleted` at all rather than a
			// `false` this file invented: the read's own default is what an unflagged request means.
			const unflagged = serviceStub([], 0);
			await testCase.call(testCase.build(unflagged, eventBusStub), { first: 2 });

			expect(unflagged.findAll).toHaveBeenCalledTimes(1);
			expect(unflagged.findAll.mock.calls[0][0]).not.toHaveProperty('withDeleted');
		}
	});

	it('declares the money this package carries as an exact decimal, never a float', () => {
		// The three amounts here are `numeric(20,6)` columns — a cost carried across a transfer and the
		// variance of a count valued at it — and they were `Float` until this assertion existed, which told
		// every generated client to parse them as doubles. `tools/scripts/money-type-check.mjs` reads the
		// composed schema; this reads the package's own contribution, so a regression is caught by the
		// suite that owns the field rather than only once the whole schema is composed.
		expect(typeBody('StockTransferLine')).toContain('unitCost: Decimal');
		// An input is not a `type`, so it is read as the document spells it rather than through `typeBody`.
		expect(described).toMatch(/input StockTransferLineInput \{[^}]*unitCost: Decimal/);
		expect(typeBody('StockCount')).toContain('varianceValue: Decimal!');
		expect(typeBody('StockCountVariance')).toContain('value: Decimal!');
	});
});

describe('every converted list field reads its page in the store', () => {
	it.each(CASES)('$field states the window it resolved and answers the rows as a connection', async (testCase) => {
		const rows = [{ id: 'row-1' }, { id: 'row-2' }];
		const service = serviceStub(rows, 7);
		const resolver = testCase.build(service, eventBusStub);

		const connection = await testCase.call(resolver, { first: 2 });

		// One read, with the filter the field declares and the window the cursor protocol resolved: `skip`
		// is a row offset here — the platform's `findAll` reads it as one — and `take` is the page size.
		expect(service.findAll).toHaveBeenCalledTimes(1);
		expect(service.findAll).toHaveBeenCalledWith({
			where: testCase.where,
			...(testCase.order ? { order: testCase.order } : {}),
			skip: 0,
			take: 2
		});

		expect(connection.nodes).toEqual(rows);
		expect(connection.edges.map((edge) => edge.node)).toEqual(rows);
		// The cursor is the row's offset, encoded opaquely: a store-paged read can resume from a position
		// but not from a value, and a cursor that pretended otherwise would skip rows after an insert.
		expect(connection.edges.map((edge) => edge.cursor)).toEqual(['MA==', 'MQ==']);
		expect(connection.totalCount).toBe(7);
		expect(connection.pageInfo.hasNextPage).toBe(true);
		expect(connection.pageInfo.hasPreviousPage).toBe(false);
		expect(connection.pageInfo.endCursor).toBe('MQ==');
	});

	it.each(CASES)(
		'$field resumes at the row the cursor names rather than at the page it falls in',
		async (testCase) => {
			const first = serviceStub([{ id: 'row-1' }, { id: 'row-2' }], 7);
			const resolver = testCase.build(first, eventBusStub);
			const answered = await testCase.call(resolver, { first: 2 });

			const second = serviceStub([{ id: 'row-3' }], 7);
			const resumed = await testCase.call(testCase.build(second, eventBusStub), {
				first: 2,
				after: answered.pageInfo.endCursor
			});

			// The cursor is exclusive and names a row, so the walk resumes two rows in — not at row one, which
			// is what a read that rounded the offset down to a page boundary would answer.
			expect(second.findAll).toHaveBeenCalledWith({
				where: testCase.where,
				...(testCase.order ? { order: testCase.order } : {}),
				skip: 2,
				take: 2
			});
			expect(resumed.nodes).toEqual([{ id: 'row-3' }]);
			expect(resumed.pageInfo.hasPreviousPage).toBe(true);
			expect(resumed.pageInfo.hasNextPage).toBe(true);
		}
	);

	it('refuses a window that states two styles rather than answering one of them', async () => {
		// The refusal is the kernel's and is not caught here: a request that states a cursor window and an
		// offset window has no defined meaning, and answering the first page to a caller that asked for a
		// position is a wrong answer it cannot detect.
		const service = serviceStub([]);
		const resolver = new StockMovementResolver(service as never, eventBusStub as never);

		await expect(resolver.stockMovements(WAREHOUSE, VARIANT, { first: 2, limit: 2 } as never)).rejects.toThrow(
			/PAGINATION_STYLE_CONFLICT/
		);
		expect(service.findAll).not.toHaveBeenCalled();
	});
});
