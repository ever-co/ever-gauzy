/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductVariantPriceController } from './product-variant-price.controller';
import { ProductVariantPriceResolver } from './product-variant-price.resolver';

/**
 * What a variant costs and what it is sold for, over GraphQL.
 *
 * The delivered REST routes serve a price list, one price, the count, the creation, the edit, the
 * removal, the soft removal and the restore — the eight capabilities every resource of this platform
 * is mounted with, since this controller declares no route of its own. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard is the controller's guard and no permission is stated**, because a resolver that
 *   demanded one would refuse a caller the REST route serves — and the count route is held to that
 *   same parity field by field, since a count narrower than its route is a capability the other
 *   protocol does not have;
 * - **the amounts are `Decimal` and the currencies are `String`**: the delivered shape is a whole
 *   number beside an ISO 4217 code, and the schema mirrors that pair rather than inventing a second
 *   representation of it — no `Float`, no rescaling, no formatted string;
 * - a price that is not there is `null` on the one-row field rather than a refusal, and the edit
 *   relies on the delivered service's own read so a missing price is a miss rather than a write that
 *   creates one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const VARIANT = '00000000-0000-4000-8000-000000000060';
const PRICE = '00000000-0000-4000-8000-000000000070';
const OTHER_PRICE = '00000000-0000-4000-8000-000000000071';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them.
 *
 * The amounts are whole numbers and the currencies are codes, which is the shape the delivered table
 * stores: `"unitCost" integer NOT NULL DEFAULT 0` beside `"unitCostCurrency" varchar NOT NULL DEFAULT
 * 'USD'`.
 */
const ROWS = [
	{
		id: PRICE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productVariantId: VARIANT,
		unitCost: 1000,
		unitCostCurrency: 'USD',
		retailPrice: 1500,
		retailPriceCurrency: 'USD',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_PRICE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productVariantId: null,
		unitCost: 250,
		unitCostCurrency: 'EUR',
		retailPrice: 400,
		retailPriceCurrency: 'EUR',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const productVariantPriceService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date() }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};

	return {
		productVariantPriceService,
		resolver: new ProductVariantPriceResolver(productVariantPriceService as never)
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

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ProductVariantPriceController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProductVariantPriceController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProductVariantPriceController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductVariantPriceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductVariantPriceResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the price connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productVariantPrices', 'productVariantPrice', 'productVariantPriceCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductVariantPrice',
				'updateProductVariantPrice',
				'deleteProductVariantPrice',
				'softDeleteProductVariantPrice',
				'recoverProductVariantPrice'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ProductVariantPriceConnection \{\s*nodes: \[ProductVariantPrice!\]!\s*edges: \[ProductVariantPriceEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductVariantPriceEdge \{\s*node: ProductVariantPrice!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductVariantPriceFilter \{/);
		expect(printed).toMatch(/input ProductVariantPriceSort \{/);
		expect(printed).toMatch(/enum ProductVariantPriceSortField \{/);
	});

	it('carries each amount as an exact decimal, never as a floating-point number', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/unitCost: Decimal!/);
		expect(printed).toMatch(/retailPrice: Decimal!/);
		// The one representation money must never take on this platform.
		expect(printed).not.toMatch(/unitCost: Float/);
		expect(printed).not.toMatch(/retailPrice: Float/);
	});

	it('mirrors the delivered pair rather than replacing it with a second representation', () => {
		const printed = printSchema(schema);

		// The table stores an integer amount beside an ISO 4217 code; the schema states the same two
		// members under the same two names, and neither a converted amount nor a formatted string is
		// added beside them.
		expect(printed).toMatch(/unitCostCurrency: String!/);
		expect(printed).toMatch(/retailPriceCurrency: String!/);
		expect(printed).not.toMatch(/unitCostMinor|unitCostFormatted|unitCostDecimal|unitCostMajor/);
	});

	it('narrows the price of one variant through the filter rather than a second root field', () => {
		// A variant holds one price, and the delivered routes serve prices only, so the concept has one
		// root field and not two.
		expect(printSchema(schema)).toMatch(/productVariantId: IDFilter/);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['productVariantPricesByVariant', 'productVariantPriceOfVariant'])
		);
	});

	it('answers the count through a field of its own and the paginated list through the connection', () => {
		const printed = printSchema(schema);

		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the
		// inherited count route counts the caller's own rows. So the count is a root field — nullable,
		// because an aggregate the resource has no answer for must not be answered as a zero — and it
		// takes no argument, the route's narrowing being a `where` fragment no schema can state.
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['productVariantPriceCount']));
		expect(printed).toMatch(/productVariantPriceCount: Int\n/);
		expect(printed).not.toMatch(/productVariantPriceCount: Int!/);
		expect(printed).not.toMatch(/productVariantPriceCount\(/);

		// `GET /pagination` is the same rows the list route answers, sliced: the page is what the
		// connection answers with, so a second field for it would be a second surface that could
		// disagree with this one.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['productVariantPricesPagination']));
		expect(printed).toMatch(/totalCount: Int!/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printSchema(schema)).not.toMatch(/productVariantPrices\([^)]*withDeleted/);
	});
});

describe('ProductVariantPriceResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		const connection = await resolver.productVariantPrices(undefined, undefined, undefined, 20);

		expect(productVariantPriceService.findAll).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PRICE);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byVariant = await resolver.productVariantPrices({ productVariantId: { eq: VARIANT } });
		expect(byVariant.nodes.map((node) => node.id)).toEqual([PRICE]);

		const byCurrency = await resolver.productVariantPrices({ unitCostCurrency: { eq: 'EUR' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([OTHER_PRICE]);
	});

	it('compares an amount through the decimal family the filter declares', async () => {
		const { resolver } = surfaces();

		// A bound is an exact amount, so a range selects the rows between two of them.
		const ranged = await resolver.productVariantPrices({ unitCost: { between: ['500', '2000'] } });
		expect(ranged.nodes.map((node) => node.id)).toEqual([PRICE]);

		// The delivered column is a whole number, so an equality states it as the column holds it.
		const exact = await resolver.productVariantPrices({ unitCost: { eq: 1000 } });
		expect(exact.nodes.map((node) => node.id)).toEqual([PRICE]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.productVariantPrices(undefined, undefined, undefined, 20);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([PRICE, OTHER_PRICE]);

		const cheapest = await resolver.productVariantPrices(undefined, [{ field: 'unitCost', direction: 'ASC' }]);
		expect(cheapest.nodes.map((node) => node.id)).toEqual([OTHER_PRICE, PRICE]);

		const dearest = await resolver.productVariantPrices(undefined, [{ field: 'retailPrice', direction: 'DESC' }]);
		expect(dearest.nodes.map((node) => node.id)).toEqual([PRICE, OTHER_PRICE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productVariantPrices(undefined, undefined, undefined, 1);

		const second = await resolver.productVariantPrices(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes).toHaveLength(1);
		expect(second.nodes[0].id).toBe(OTHER_PRICE);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariantPrices(undefined, [{ field: 'unitCostCurrency', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariantPrices({ deletedAt: { eq: '2026-01-01' } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a request that states both pagination styles', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariantPrices(undefined, undefined, undefined, 10, undefined, undefined, undefined, 10)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('refuses a page larger than the protocol allows', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariantPrices(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1000)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ProductVariantPriceResolver — one concept, two protocols, the same operations', () => {
	it('reads one price through the same service method the REST route calls', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		expect(await resolver.productVariantPrice(PRICE)).toBe(ROWS[0]);
		expect(productVariantPriceService.findOneByIdString).toHaveBeenCalledWith(PRICE);
	});

	it('answers null for a price that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productVariantPriceService } = surfaces();
		productVariantPriceService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productVariantPrice(OTHER_PRICE)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		expect(await resolver.productVariantPriceCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(productVariantPriceService.countBy).toHaveBeenCalledWith();
	});

	it('prices a variant through the same service method the REST route calls', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		await resolver.createProductVariantPrice({
			unitCost: '1000',
			unitCostCurrency: 'USD',
			retailPrice: '1500',
			retailPriceCurrency: 'USD',
			productVariantId: VARIANT
		});

		// The tenant is the credential's and is stamped by the service; the pair is passed through
		// exactly as stated, with no conversion of either half.
		expect(productVariantPriceService.create).toHaveBeenCalledWith({
			unitCost: '1000',
			unitCostCurrency: 'USD',
			retailPrice: '1500',
			retailPriceCurrency: 'USD',
			productVariantId: VARIANT
		});
	});

	it('edits through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		await resolver.updateProductVariantPrice({ id: PRICE, retailPrice: '1750' });

		expect(productVariantPriceService.update).toHaveBeenCalledWith(PRICE, { retailPrice: '1750' });
		// The row the write produced is read back, because the delivered route answers the store's own
		// update result rather than a row.
		expect(productVariantPriceService.findOneByIdString).toHaveBeenCalledWith(PRICE);
	});

	it('relies on the delivered read before the write, so a missing price is a miss rather than a write', async () => {
		const { resolver, productVariantPriceService } = surfaces();
		productVariantPriceService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateProductVariantPrice({ id: OTHER_PRICE, retailPrice: '1' })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(productVariantPriceService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('removes a price through the same service method the REST route calls', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		expect(await resolver.deleteProductVariantPrice(PRICE)).toBe(true);
		expect(productVariantPriceService.delete).toHaveBeenCalledWith(PRICE);
	});

	it('withdraws a price softly and puts it back through the same two service methods', async () => {
		const { resolver, productVariantPriceService } = surfaces();

		const withdrawn = await resolver.softDeleteProductVariantPrice(PRICE);
		expect(productVariantPriceService.softRemove).toHaveBeenCalledWith(PRICE);
		expect(withdrawn.id).toBe(PRICE);

		const restored = await resolver.recoverProductVariantPrice(PRICE);
		expect(productVariantPriceService.softRecover).toHaveBeenCalledWith(PRICE);
		expect(restored.id).toBe(PRICE);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productVariantPriceService } = surfaces();
		const refusal = new Error('PRODUCT_VARIANT_PRICE_LOCKED: this price is on an open order.');

		productVariantPriceService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteProductVariantPrice(PRICE)).rejects.toBe(refusal);
	});
});

describe('ProductVariantPriceResolver — the guard stack is the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductVariantPriceResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductVariantPriceController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// Neither surface carries the permission guard, so neither demands a permission the other does
		// not: two scopes for one concept is what the two-protocol rule forbids.
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantPriceResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantPriceController)).toBeUndefined();
	});

	it('runs the count route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductVariantPriceResolver) ?? [];

		// The count route is the one the CRUD base mounts: it states no guard and no permission of its
		// own, so the controller's class-level chain is the whole of its scope — and the resolver
		// states the same chain, which is the parity claim a count narrower or wider than its route
		// would break.
		expect(guardsOfRoute(ProductVariantPriceController, 'getCount').sort()).toEqual([...stated].sort());
		expect(
			Reflect.getMetadata('__guards__', handlersOf(ProductVariantPriceController)['getCount'])
		).toBeUndefined();

		// A class-level permission would apply to a handler that states none, so the parity is
		// asserted over the two readings rather than over the handler alone: neither surface states
		// one, and the count field states none either.
		expect(permissionOfRoute(ProductVariantPriceController, 'getCount')).toBeUndefined();
		expect(permissionOfField('productVariantPriceCount')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s permission', () => {
		const routes: Array<[string, string]> = [
			['productVariantPrices', 'findAll'],
			['productVariantPrice', 'findById'],
			['productVariantPriceCount', 'getCount'],
			['createProductVariantPrice', 'create'],
			['updateProductVariantPrice', 'update'],
			['deleteProductVariantPrice', 'delete'],
			['softDeleteProductVariantPrice', 'softRemove'],
			['recoverProductVariantPrice', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ProductVariantPriceController, handler)])
		);

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handlers are asserted to be there before the two readings are compared.
			expect(typeof handlersOf(ProductVariantPriceController)[handler]).toBe('function');
		}

		// Every one of them is `undefined`, which is the answer here and not an empty assertion: this
		// resource is mounted without a permission, so a field that acquired one would be the
		// asymmetry the two-protocol rule forbids.
		expect(stated).toEqual(expected);
	});
});
