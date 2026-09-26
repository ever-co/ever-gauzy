/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { WarehouseController } from './warehouse.controller';
import { WarehouseResolver } from './warehouse.resolver';

/**
 * The stock location, and the stock levels one controller serves beside it.
 *
 * The delivered `/api/warehouses` routes serve a list, a page, a count, one location, a filing, an
 * edit, a removal, the two lifecycle moves, and — on the same controller — a read of one location's
 * stock levels, a bulk write that opens levels, and two writes that set a level's quantity. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and each list is a connection with the
 *   platform's own cursor codec behind it;
 * - every field reaches the same service method the REST route reaches;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — the five reads under the class's *view* override, every write under its edit one;
 * - **the stock levels are a root field of their own**, because that read answers level rows joined
 *   to the product each counts rather than a narrowed list of locations;
 * - the nine columns the delivered write body cannot carry are readable and are not writeable.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000030';
const TAG = '00000000-0000-4000-8000-000000000050';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';
const PRODUCT = '00000000-0000-4000-8000-000000000070';
const VARIANT = '00000000-0000-4000-8000-000000000071';
const LEVEL = '00000000-0000-4000-8000-000000000080';
const VARIANT_LEVEL = '00000000-0000-4000-8000-000000000081';

/** The locations a scripted service answers with. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Central',
		code: 'C1',
		email: 'central@northwind.test',
		description: 'The main depot',
		active: true,
		type: 'WAREHOUSE',
		priority: 1,
		isPickupLocation: false,
		isFulfillmentLocation: true,
		latitude: 52.52,
		longitude: 13.405,
		timezone: 'Europe/Berlin',
		cutoffTime: '14:00',
		sellerId: null,
		logoId: null,
		contactId: CONTACT,
		metadata: { docks: 4 },
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Kiosk',
		code: 'K1',
		email: 'kiosk@northwind.test',
		description: null,
		active: true,
		type: 'STORE',
		priority: 5,
		isPickupLocation: true,
		isFulfillmentLocation: false,
		latitude: null,
		longitude: null,
		timezone: null,
		cutoffTime: null,
		sellerId: null,
		logoId: null,
		contactId: null,
		metadata: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The stock levels a scripted read answers with, in the order the delivered read returns them. */
const LEVELS = [
	{
		id: LEVEL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		warehouseId: FIRST,
		productId: PRODUCT,
		quantity: '12.000000',
		reservedQuantity: '2.000000',
		incomingQuantity: '0.000000',
		safetyStock: '0.000000',
		allowBackorder: false,
		backorderLimit: null,
		restockThreshold: '5.000000',
		trackInventory: true,
		isUnlimited: false,
		binLocation: 'A-01',
		version: 3,
		metadata: null,
		variants: [
			{
				id: VARIANT_LEVEL,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				warehouseProductId: LEVEL,
				variantId: VARIANT,
				quantity: '12.000000',
				reservedQuantity: '2.000000',
				safetyStock: '0.000000',
				incomingQuantity: '0.000000',
				backorderLimit: null,
				isUnlimited: false,
				allowBackorder: false,
				version: 2,
				restockThreshold: null,
				trackInventory: true,
				binLocation: null,
				binId: null,
				unitCategoryId: null,
				metadata: null
			}
		]
	}
];

/** The resolver, over scripted services. */
function surfaces() {
	const warehouseService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const warehouseProductService = {
		getAllWarehouseProducts: jest.fn().mockResolvedValue(LEVELS),
		createWarehouseProductBulk: jest.fn().mockResolvedValue({ items: LEVELS, total: LEVELS.length }),
		updateWarehouseProductQuantity: jest.fn().mockResolvedValue({ ...LEVELS[0], quantity: '20.000000' }),
		updateWarehouseProductVariantQuantity: jest
			.fn()
			.mockResolvedValue({ ...LEVELS[0].variants[0], quantity: '20.000000' })
	};

	return {
		warehouseService,
		warehouseProductService,
		resolver: new WarehouseResolver(warehouseService as never, warehouseProductService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The printed body of one type, object or input, so a member it must not carry can be asserted absent. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof WarehouseController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof WarehouseController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof WarehouseController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = WarehouseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['warehouses', 'findAll'],
	['warehouse', 'findById'],
	['warehouseCount', 'getCount'],
	['warehouseInventory', 'findAllWarehouseProducts'],
	['createWarehouse', 'create'],
	['updateWarehouse', 'update'],
	['deleteWarehouse', 'delete'],
	['softDeleteWarehouse', 'softRemove'],
	['recoverWarehouse', 'softRecover'],
	['addWarehouseProducts', 'addWarehouseProducts'],
	['updateWarehouseProductQuantity', 'updateWarehouseProductQuantity'],
	['updateWarehouseProductVariantQuantity', 'updateWarehouseProductVariantQuantity']
];

describe('WarehouseResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the location reads, the count and the inventory read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['warehouses', 'warehouse', 'warehouseCount', 'warehouseInventory'])
		);
	});

	it('declares one mutation per delivered write route, location and stock level alike', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createWarehouse',
				'updateWarehouse',
				'deleteWarehouse',
				'softDeleteWarehouse',
				'recoverWarehouse',
				'addWarehouseProducts',
				'updateWarehouseProductQuantity',
				'updateWarehouseProductVariantQuantity'
			])
		);
	});

	it('declares both connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type WarehouseConnection \{\s*nodes: \[Warehouse!\]!\s*edges: \[WarehouseEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type WarehouseProductConnection \{\s*nodes: \[WarehouseProduct!\]!\s*edges: \[WarehouseProductEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input WarehouseFilter \{/);
		expect(printed).toMatch(/input WarehouseProductFilter \{/);
		expect(printed).toMatch(
			/enum WarehouseSortField \{\s*createdAt\s*updatedAt\s*name\s*code\s*email\s*priority\s*\}/
		);
	});

	it('carries every stock quantity as an exact decimal rather than a float', () => {
		const level = body('WarehouseProduct', 'type');
		const variantLevel = body('WarehouseProductVariant', 'type');

		for (const member of ['quantity', 'reservedQuantity', 'incomingQuantity', 'safetyStock', 'backorderLimit']) {
			expect(level).toMatch(new RegExp(`${member}: Decimal`));
			expect(variantLevel).toMatch(new RegExp(`${member}: Decimal`));
		}

		// The columns behind them are `numeric`: a binary fraction cannot hold a stock number exactly.
		expect(level).not.toMatch(/: Float/);
		expect(variantLevel).not.toMatch(/: Float/);
		// Coordinates are the two `Float` members of the location, and they are coordinates.
		expect(body('Warehouse', 'type')).toMatch(/latitude: Float/);
		expect(body('Warehouse', 'type')).toMatch(/longitude: Float/);
	});

	it('carries the columns the delivered body cannot write, because a filter is a read', () => {
		const location = body('Warehouse', 'type');
		const create = body('CreateWarehouseInput', 'input');

		for (const member of [
			'type: String',
			'priority: Int',
			'isPickupLocation: Boolean',
			'isFulfillmentLocation: Boolean',
			'timezone: String',
			'cutoffTime: String',
			'sellerId: ID',
			'metadata: JSON'
		]) {
			expect(location).toMatch(new RegExp(member));
			expect(create).not.toContain(member.split(':')[0] + ':');
		}

		// A filter is a read, so the same columns do narrow a list.
		expect(body('WarehouseFilter', 'input')).toMatch(/isFulfillmentLocation: BooleanFilter/);
		expect(body('WarehouseFilter', 'input')).toMatch(/priority: NumberFilter/);
	});

	it('offers no argument it cannot honour, and drops the member the bulk write never reads', () => {
		expect(printed).not.toMatch(/warehouseCount\(/);
		// `variantIds` is on the contracts type, and the delivered service never reads it: it opens a
		// level for every variant the product itself carries.
		expect(body('AddWarehouseProductsInput', 'input')).toMatch(/productIds: \[ID!\]!/);
		expect(body('AddWarehouseProductsInput', 'input')).not.toContain('variantIds');
	});
});

describe('WarehouseResolver — the connections’ contract', () => {
	it('answers the location list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, warehouseService } = surfaces();

		const connection = await resolver.warehouses(undefined, undefined, undefined, 20);

		expect(warehouseService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows and orders the location list by the fields it declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.warehouses({ isFulfillmentLocation: { eq: false } })).nodes.map((n) => n.id)).toEqual([
			SECOND
		]);
		expect((await resolver.warehouses(undefined, [{ field: 'priority', direction: 'ASC' }])).nodes.map((n) => n.id)).toEqual(
			[FIRST, SECOND]
		);
	});

	it('reads the stock levels of one location through the delivered read', async () => {
		const { resolver, warehouseProductService } = surfaces();

		const connection = await resolver.warehouseInventory(FIRST, undefined, undefined, undefined, 20);

		expect(warehouseProductService.getAllWarehouseProducts).toHaveBeenCalledWith(FIRST);
		expect(connection.nodes.map((node) => node.id)).toEqual([LEVEL]);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LEVEL);
	});

	it('narrows a stock list by a decimal quantity, which is why the bounds are decimal', async () => {
		const { resolver } = surfaces();

		expect((await resolver.warehouseInventory(FIRST, { quantity: { lte: '12.000000' } })).totalCount).toBe(1);
		expect((await resolver.warehouseInventory(FIRST, { quantity: { gt: '12.000000' } })).totalCount).toBe(0);
	});

	it('refuses a sort field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.warehouseInventory(FIRST, undefined, [{ field: 'isUnlimited', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.warehouses({ products: { eq: PRODUCT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('WarehouseResolver — one concept, two protocols, the same operations', () => {
	it('reads one location through the same service method the REST route calls', async () => {
		const { resolver, warehouseService } = surfaces();

		expect(await resolver.warehouse(FIRST)).toBe(ROWS[0]);
		expect(warehouseService.findById).toHaveBeenCalledWith(FIRST, []);
	});

	it('answers null for a location that is not there', async () => {
		const { resolver, warehouseService } = surfaces();
		warehouseService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.warehouse(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, warehouseService } = surfaces();

		expect(await resolver.warehouseCount()).toBe(2);
		expect(warehouseService.countBy).toHaveBeenCalledWith();
	});

	it('files a location through the same service method the REST route calls', async () => {
		const { resolver, warehouseService } = surfaces();

		await resolver.createWarehouse({
			organizationId: ORGANIZATION,
			name: 'Central',
			code: 'C1',
			email: 'central@northwind.test',
			contactId: CONTACT,
			tagIds: [TAG]
		});

		expect(warehouseService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, code: 'C1', contactId: CONTACT, tagIds: [TAG] })
		);
	});

	it('changes a location through the delivered edit route’s own call, which is the upsert', async () => {
		const { resolver, warehouseService } = surfaces();

		const updated = await resolver.updateWarehouse({
			id: FIRST,
			organizationId: ORGANIZATION,
			name: 'Central',
			code: 'C1',
			email: 'central@northwind.test',
			active: false
		});

		// The delivered edit route does not reach the CRUD base's partial update: it persists the stated
		// body beside the path identifier through `create`.
		expect(warehouseService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			name: 'Central',
			code: 'C1',
			email: 'central@northwind.test',
			active: false,
			id: FIRST
		});
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a location through the same service method the REST route calls', async () => {
		const { resolver, warehouseService } = surfaces();

		expect(await resolver.deleteWarehouse(FIRST)).toBe(true);
		expect(warehouseService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a location through the same service methods the REST routes call', async () => {
		const { resolver, warehouseService } = surfaces();

		expect((await resolver.softDeleteWarehouse(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(warehouseService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverWarehouse(FIRST)).toBe(ROWS[0]);
		expect(warehouseService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('opens stock levels through the same service method the delivered bulk route calls', async () => {
		const { resolver, warehouseProductService } = surfaces();

		const created = await resolver.addWarehouseProducts(FIRST, { productIds: [PRODUCT] });

		// The list the input carries is handed on in the row shape the delivered body uses, because the
		// service reads nothing from each row but the product identifier.
		expect(warehouseProductService.createWarehouseProductBulk).toHaveBeenCalledWith([{ productId: PRODUCT }], FIRST);
		// The delivered route answers the page envelope; the rows are its `items` and the length is its
		// `total`.
		expect(created.map((row) => row.id)).toEqual([LEVEL]);
	});

	it('sets a product level’s quantity through the same service method the delivered route calls', async () => {
		const { resolver, warehouseProductService } = surfaces();

		const level = await resolver.updateWarehouseProductQuantity(LEVEL, 20);

		expect(warehouseProductService.updateWarehouseProductQuantity).toHaveBeenCalledWith(LEVEL, 20);
		expect(level.quantity).toBe('20.000000');
	});

	it('sets a variant level’s quantity through the same service method, which rolls the sum up', async () => {
		const { resolver, warehouseProductService } = surfaces();

		const level = await resolver.updateWarehouseProductVariantQuantity(VARIANT_LEVEL, 20);

		expect(warehouseProductService.updateWarehouseProductVariantQuantity).toHaveBeenCalledWith(VARIANT_LEVEL, 20);
		expect(level.quantity).toBe('20.000000');
	});

	it('lets a refusal through rather than turning it into an answer', async () => {
		const { resolver, warehouseProductService } = surfaces();
		const refusal = new NotFoundException('Warehouse with ID … not found');

		warehouseProductService.createWarehouseProductBulk.mockRejectedValueOnce(refusal);

		await expect(resolver.addWarehouseProducts(SECOND, { productIds: [PRODUCT] })).rejects.toBe(refusal);
	});
});

describe('WarehouseResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', WarehouseResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', WarehouseController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', WarehouseResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(WarehouseController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, WarehouseResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, WarehouseController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(WarehouseController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view permission on the five reads and the class’s edit one on every write', () => {
		for (const field of ['warehouses', 'warehouse', 'warehouseCount', 'warehouseInventory']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INVENTORY_VIEW]);
		}

		// The four inventory writes state no permission of their own, so they run — and are restated
		// here — under the class-level edit permission.
		for (const field of [
			'createWarehouse',
			'updateWarehouse',
			'deleteWarehouse',
			'softDeleteWarehouse',
			'recoverWarehouse',
			'addWarehouseProducts',
			'updateWarehouseProductQuantity',
			'updateWarehouseProductVariantQuantity'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT]);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (WarehouseResolver.prototype as never)[field],
		getClass: () => WarehouseResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('WarehouseResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, WarehouseResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', WarehouseResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('warehouses')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('warehouses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('warehouses'))).resolves.toBe(true);
	});
});
