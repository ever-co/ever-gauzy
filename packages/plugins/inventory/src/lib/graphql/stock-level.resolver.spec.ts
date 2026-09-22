/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a GraphQL resolver needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the resolvers under test are the real ones**, bound to a stubbed service so
 * what a field delegates to is asserted rather than inferred.
 *
 * The permission decorator is doubled with the platform’s own metadata key, read from the platform’s
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator’s prose.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

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
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
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
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class TenantPermissionGuard {},
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
		// The three the package's list fields answer connections through. They are the kernel's own
		// implementations rather than stand-ins written here: a `resolveConnectionWindow` this factory
		// invented would let a suite agree with itself about a window the platform does not compute, which
		// is the one thing a resolver suite must not do.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { print } from 'graphql';
import { Observable, from } from 'rxjs';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { StockLevelController } from './../stock-level/stock-level.controller';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockLevelResolver } from './stock-level.resolver';

/**
 * The stock level concept over GraphQL (doc 09 §10.4, §15.6).
 *
 * The programme’s API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong:
 *
 * - the reconciliation the REST resource serves at its route is a **mutation** here, delegating to the
 *   same service method with the same scope, so a client is not choosing a better surface by choosing
 *   a protocol;
 * - it carries the reconciliation permission rather than the read permission the queries carry, so a
 *   role that may look at levels cannot correct them by asking GraphQL instead of REST;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads;
 * - the query takes the same filters its REST counterpart takes, because a query with fewer filters
 *   than the route it mirrors is the same defect in a quieter form;
 * - the schema document and the resolver decorators agree on every name, and the concept is spelled
 *   `stock*` on both sides.
 */

const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000030';

/** The report a reconciliation answers with, so the two surfaces can be compared by identity. */
const REPORT = {
	scanned: 2,
	corrected: 1,
	corrections: [
		{
			levelId: 'level-1',
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantityBefore: 10,
			ledgerQuantity: 7,
			quantityAfter: 7
		}
	]
};

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the doctrine is about: both protocols must reach the same method with the
 * same scope, and a stub is what makes that visible without a database behind it.
 */
function surfaces() {
	const service = {
		reconcile: jest.fn().mockResolvedValue(REPORT),
		findLevels: jest.fn().mockResolvedValue([{ levelId: 'level-1' }]),
		// The paged read the connection answers from, which the route's own read delegates to: a double that
		// only stood in for the array would leave the spec asserting a shape the SDL no longer declares.
		listLevels: jest.fn().mockResolvedValue({ items: [{ levelId: 'level-1' }], total: 1 }),
		findLevel: jest.fn().mockResolvedValue({ levelId: 'level-1' }),
		availableQuantity: jest.fn().mockResolvedValue(7)
	};
	const eventBus = { ofType: () => ({ pipe: () => 'the level stream' }) };

	return {
		service,
		controller: new StockLevelController(service as never),
		resolver: new StockLevelResolver(service as never, eventBus as never)
	};
}

/** The composed schema document, as text, so a field can be asserted the way a client reads it. */
const schemaText = print(inventorySchemaExtensions);

describe('StockLevelResolver — the reconciliation over GraphQL (doc 09 §10.4)', () => {
	it('reconciles through the same service method the REST route calls, with the same scope', async () => {
		const { service, controller, resolver } = surfaces();
		const scope = { warehouseId: WAREHOUSE, variantId: VARIANT, take: 10 };

		const overRest = await controller.reconcile(scope);
		const overGraphql = await resolver.reconcileStockLevels(scope);

		expect(service.reconcile).toHaveBeenNthCalledWith(1, scope);
		expect(service.reconcile).toHaveBeenNthCalledWith(2, scope);
		// One answer, one implementation: the two protocols are not two ways of doing the same thing.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(REPORT);
	});

	it('accepts a run that states no scope, because the scope is optional on both surfaces', async () => {
		const { service, resolver } = surfaces();

		await resolver.reconcileStockLevels(undefined);

		expect(service.reconcile).toHaveBeenCalledWith({
			warehouseId: undefined,
			variantId: undefined,
			take: undefined
		});
	});

	it('is not reachable with the permission that only reads levels', () => {
		// What a guard reads: the handler’s own metadata when it declares one, the class’s metadata
		// otherwise. The class carries the read permission, so the mutation has to state the
		// reconciliation permission itself — a caller holding only `STOCK_VIEW` is refused here exactly
		// as it is refused at the REST route.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver)).toEqual(['STOCK_VIEW']);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver.prototype.reconcileStockLevels)).toEqual([
			'STOCK_RECONCILE'
		]);
		// Every query states the read permission, and none of them states the reconciliation one.
		for (const read of ['stockLevels', 'stockLevel', 'availableQuantity'] as const) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver.prototype[read])).toEqual(['STOCK_VIEW']);
		}
	});

	it('guards both surfaces with the tenant and permission guards', () => {
		for (const surface of [StockLevelResolver, StockLevelController]) {
			const guards = Reflect.getMetadata('__guards__', surface) ?? [];

			expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		}
	});
});

describe('StockLevelResolver — one concept, two protocols, the same names (doc 09 §11)', () => {
	it('declares the reconciliation as a mutation with its input and its report', () => {
		expect(schemaText).toMatch(/reconcileStockLevels\(input: StockLevelReconciliationInput\): StockLevelReconciliation!/);
		// The input states the three filters the run walks and the two conventions the mutation adopted:
		// the level counter a conditional run is stated against, and the key a retry presents. Both are
		// nullable, so a caller that states neither is answered rather than refused.
		expect(schemaText).toMatch(/input StockLevelReconciliationInput \{\s*warehouseId: ID\s+variantId: ID\s+take: Int\s+version: Int\s+idempotencyKey: String\s*\}/);
		expect(schemaText).toMatch(/type StockLevelReconciliation \{\s*scanned: Int!\s*corrected: Int!\s*corrections: \[StockLevelCorrection!\]!\s*\}/);
		expect(schemaText).toMatch(/type StockLevelCorrection \{/);
		// The mutation block is where a write belongs: the queries stay queries.
		expect(schemaText).toMatch(/type Mutation \{[\s\S]*reconcileStockLevels/);
	});

	it('gives the level query the same filters the REST list accepts', async () => {
		const { service, resolver } = surfaces();

		// The page is the connection's: the field answers the window the caller stated and the count of the set
		// the filters select, both read from the paged read the service owns. `take` is gone with it, because a
		// field that accepts both a page and a size has two ways to state one thing.
		const connection = await resolver.stockLevels(WAREHOUSE, VARIANT, { first: 25 });

		expect(service.listLevels).toHaveBeenCalledWith({ warehouseId: WAREHOUSE, variantId: VARIANT, skip: 0, take: 25 });
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(schemaText).toMatch(
			/stockLevels\(warehouseId: ID, variantId: ID, page: PageInput, withDeleted: Boolean\): StockLevelConnection!/
		);
		expect(schemaText).toMatch(/type StockLevelConnection \{\s*nodes: \[StockLevel!\]!\s*edges: \[StockLevelEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/);
	});

	it('spells the concept `stock*` on both halves of the schema', () => {
		// The names the two protocols are joined by. A root field named for the package rather than for
		// the concept is how the same resource ends up reachable under two names, and how half of it goes
		// missing behind one of them.
		const resolverSource = readFileSync(join(__dirname, 'stock-level.resolver.ts'), 'utf8');

		for (const half of [schemaText, resolverSource]) {
			expect(half).not.toMatch(/inventoryLevel/);
		}
		expect(schemaText).toMatch(/stockLevel\(warehouseId: ID!, variantId: ID!\): StockLevel/);
		expect(schemaText).toMatch(/stockLevelChanged\(warehouseId: ID, variantId: ID\): StockLevel!/);
		expect(resolverSource).toMatch(/@Query\('stockLevels'\)/);
		expect(resolverSource).toMatch(/@Query\('stockLevel'\)/);
		expect(resolverSource).toMatch(/@Mutation\('reconcileStockLevels'\)/);
		expect(resolverSource).toMatch(/@Subscription\('stockLevelChanged'\)/);
		// The two derived level streams were declared in the schema and bound to nothing, so a client
		// that subscribed to either was accepted and then never heard anything — which is the one
		// failure a subscription cannot be told apart from a quiet warehouse.
		expect(schemaText).toMatch(/stockLevelLow\(warehouseId: ID\): StockLevel!/);
		expect(schemaText).toMatch(/stockLevelOutOfStock\(warehouseId: ID\): StockLevel!/);
		expect(resolverSource).toMatch(/@Subscription\('stockLevelLow'\)/);
		expect(resolverSource).toMatch(/@Subscription\('stockLevelOutOfStock'\)/);
		// The availability a level derives stays a computation over the level rather than a level of its
		// own: it is named for what it answers.
		expect(resolverSource).toMatch(/@Query\('availableQuantity'\)/);
	});

	it('narrows a level stream to the location and the variant the subscriber asked about', async () => {
		// The arguments are declared in the schema and were read by nothing, so a client that subscribed
		// to one location's levels was handed every level of the tenant and had to filter them itself —
		// the opposite of what a subscription argument is for, on the one transport where the server pays
		// for every frame it sends.
		const published = [
			{ level: { warehouseId: WAREHOUSE, variantId: VARIANT, availableQuantity: 1 } },
			{ level: { warehouseId: 'another-location', variantId: VARIANT, availableQuantity: 2 } },
			{ level: { warehouseId: WAREHOUSE, variantId: 'another-variant', availableQuantity: 3 } }
		];
		const resolver = new StockLevelResolver({} as never, { ofType: () => from(published) } as never);

		await expect(collect(resolver.stockLevelChanged(WAREHOUSE, VARIANT))).resolves.toEqual([
			{ warehouseId: WAREHOUSE, variantId: VARIANT, availableQuantity: 1 }
		]);
		// A stream the caller narrowed to a location alone keeps every variant of it, and a caller that
		// narrowed nothing is handed everything, which is what a nullable argument means.
		await expect(collect(resolver.stockLevelLow(WAREHOUSE))).resolves.toHaveLength(2);
		await expect(collect(resolver.stockLevelOutOfStock(undefined as never))).resolves.toHaveLength(3);
	});
});

/**
 * Reads a subscription stream to its end.
 *
 * @param stream The observable a subscription field answered with.
 * @returns Everything it published, in order.
 */
function collect(stream: unknown): Promise<unknown[]> {
	const seen: unknown[] = [];

	return new Promise((resolve, reject) => {
		(stream as Observable<unknown>).subscribe({
			next: (value) => seen.push(value),
			error: reject,
			complete: () => resolve(seen)
		});
	});
}
