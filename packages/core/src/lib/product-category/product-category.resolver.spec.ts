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
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryResolver } from './product-category.resolver';
import { ProductCategoryCreateCommand } from './commands';

/**
 * The product taxonomy over GraphQL.
 *
 * The delivered REST routes serve a category list, one category, a count, a filing, a replacement, a
 * removal, and the withdrawal and restoration of a category. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the node query, whose route inherits the controller's class-level edit
 *   permission because it declares none of its own;
 * - the translated members the REST surface merges onto the row are what the object type carries, and
 *   the members that reader cannot produce are not declared at all;
 * - a category that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ROOT = '00000000-0000-4000-8000-000000000010';
const CHILD = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them, each
 * already carrying the translation the reader merged for the caller's language.
 */
const ROWS = [
	{
		id: ROOT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Apparel',
		description: 'Everything worn',
		slug: 'apparel',
		sortOrder: 2,
		isFeatured: true,
		status: 'ACTIVE',
		parentId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: CHILD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Books',
		description: 'Everything read',
		slug: 'books',
		sortOrder: 1,
		isFeatured: false,
		status: 'DRAFT',
		parentId: ROOT,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const productCategoryService = {
		findProductCategories: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		updateProductCategory: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		productCategoryService,
		commandBus,
		resolver: new ProductCategoryResolver(productCategoryService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('productcategor'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ProductCategoryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProductCategoryController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProductCategoryController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductCategoryResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductCategoryResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productCategories', 'productCategory', 'productCategoryCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductCategory',
				'updateProductCategory',
				'deleteProductCategory',
				'softDeleteProductCategory',
				'recoverProductCategory'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['productCategories', 'productCategory', 'productCategoryCount']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createProductCategory',
			'deleteProductCategory',
			'recoverProductCategory',
			'softDeleteProductCategory',
			'updateProductCategory'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ProductCategoryConnection \{\s*nodes: \[ProductCategory!\]!\s*edges: \[ProductCategoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductCategoryEdge \{\s*node: ProductCategory!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductCategoryFilter \{/);
		expect(printed).toMatch(/input ProductCategorySort \{/);
		expect(printed).toMatch(
			/enum ProductCategorySortField \{\s*createdAt\s*updatedAt\s*name\s*slug\s*sortOrder\s*status\s*isFeatured\s*\}/
		);
	});

	it('carries the translated members the delivered reader merges, and not the collection it drops', () => {
		const body = typeBody('ProductCategory');

		expect(body).toMatch(/name: String/);
		expect(body).toMatch(/description: String/);
		// The merge copies the members out of the translation collection and deletes it in the same
		// step, so a `translations` member would be absent from exactly the rows this surface answers.
		expect(body).not.toContain('translations');
		// The reverse side is loaded only when a REST caller names it in `relations`, which this
		// surface's read does not: the products of a category are reachable as `Product.productCategoryId`.
		expect(body).not.toContain('products');
		// The vocabulary of `status` is the kernel extension's own, shared with the product's lifecycle
		// column, so the member is carried as its value rather than declared as an enum here.
		expect(body).toMatch(/status: String!/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/productCategories\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/productCategoryCount\(/);
	});
});

describe('ProductCategoryResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productCategoryService } = surfaces();

		const connection = await resolver.productCategories(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, in the language the same request names.
		expect(productCategoryService.findProductCategories).toHaveBeenCalledWith({}, LanguagesEnum.ENGLISH);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CHILD);
	});

	it('orders by the taxonomy’s own sibling order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.productCategories();

		expect(connection.nodes.map((node) => node.id)).toEqual([CHILD, ROOT]);
	});

	it('narrows by the fields the filter declares, including the merged name', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.productCategories({ status: { eq: 'DRAFT' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([CHILD]);

		const byRoot = await resolver.productCategories({ parentId: { isNull: true } });
		expect(byRoot.nodes.map((node) => node.id)).toEqual([ROOT]);

		const byName = await resolver.productCategories({ name: { ilike: 'app%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ROOT]);

		// A category whose translation did not match carries neither merged member, which is what
		// `isNull` states and what an `eq` never matches.
		expect((await resolver.productCategories({ name: { isNull: true } })).totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.productCategories(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([ROOT, CHILD]);

		const byOrder = await resolver.productCategories(undefined, [{ field: 'sortOrder', direction: 'DESC' }]);
		expect(byOrder.nodes.map((node) => node.id)).toEqual([ROOT, CHILD]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productCategories(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([CHILD]);

		const second = await resolver.productCategories(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ROOT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.productCategories(undefined, undefined, undefined, 20);

		const last = await resolver.productCategories(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([CHILD]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productCategories(undefined, [{ field: 'imageId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.productCategories({ products: { eq: ROOT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productCategories(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ProductCategoryResolver — one concept, two protocols, the same operations', () => {
	it('reads one category through the same service method the REST route calls', async () => {
		const { resolver, productCategoryService } = surfaces();

		expect(await resolver.productCategory(ROOT)).toBe(ROWS[0]);
		expect(productCategoryService.findOneByIdString).toHaveBeenCalledWith(ROOT);
	});

	it('answers null for a category that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productCategoryService } = surfaces();
		productCategoryService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productCategory(CHILD)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productCategoryService } = surfaces();

		expect(await resolver.productCategoryCount()).toBe(2);
		expect(productCategoryService.countBy).toHaveBeenCalledWith();
	});

	it('files a category through the command the REST route dispatches, in the caller’s language', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createProductCategory({
			organizationId: ORGANIZATION,
			slug: 'apparel',
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'Apparel' }]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ProductCategoryCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			slug: 'apparel',
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'Apparel' }]
		});
		expect(command.language).toBe(LanguagesEnum.ENGLISH);
	});

	it('replaces a category through the same service method the REST route calls', async () => {
		const { resolver, productCategoryService } = surfaces();

		await resolver.updateProductCategory({ id: ROOT, organizationId: ORGANIZATION, slug: 'apparel-2' });

		expect(productCategoryService.updateProductCategory).toHaveBeenCalledWith(
			ROOT,
			expect.objectContaining({ id: ROOT, slug: 'apparel-2' })
		);
	});

	it('removes a category through the same service method the REST route calls', async () => {
		const { resolver, productCategoryService } = surfaces();

		expect(await resolver.deleteProductCategory(ROOT)).toBe(true);
		expect(productCategoryService.delete).toHaveBeenCalledWith(ROOT);
	});

	it('withdraws and restores a category through the same service methods the REST routes call', async () => {
		const { resolver, productCategoryService } = surfaces();

		const withdrawn = await resolver.softDeleteProductCategory(ROOT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(productCategoryService.softRemove).toHaveBeenCalledWith(ROOT);

		expect(await resolver.recoverProductCategory(ROOT)).toBe(ROWS[0]);
		expect(productCategoryService.softRecover).toHaveBeenCalledWith(ROOT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productCategoryService } = surfaces();
		const refusal = new Error('PRODUCT_CATEGORY_STILL_REFERENCED: a product still points at this category.');

		productCategoryService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteProductCategory(ROOT)).rejects.toBe(refusal);
	});
});

describe('ProductCategoryResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductCategoryResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductCategoryController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductCategoryResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			// The controller's chain and the resolver's are the same set, which is the whole parity claim:
			// a route that added a guard of its own would narrow REST below GraphQL and is caught here.
			// `findAll` restates `PermissionGuard` beside the class that already carries it, which is the
			// one route where the two lists differ in length and not in scope.
			expect(guardsOfRoute(ProductCategoryController, handler).sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductCategoryResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ProductCategoryController)
		);
		expect(permissionOfField('createProductCategory')).toEqual([PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['productCategories', 'findAll'],
			['productCategory', 'findById'],
			['productCategoryCount', 'getCount'],
			['createProductCategory', 'create'],
			['updateProductCategory', 'update'],
			['deleteProductCategory', 'delete'],
			['softDeleteProductCategory', 'softRemove'],
			['recoverProductCategory', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ProductCategoryController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the edit permission on the node query, because the route it mirrors does', () => {
		// The delivered `GET /:id` is inherited from the base controller without a permission of its
		// own, so it runs under the controller's class-level permission — and the field states the same
		// one rather than the view permission its read siblings carry. Reading one category and listing
		// them requiring different grants is the controller's asymmetry; widening it here, on one
		// surface only, is exactly what the two-protocol rule forbids.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductCategoryController.prototype.findById)).toBeUndefined();
		expect(permissionOfField('productCategory')).toEqual([PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT]);
		expect(permissionOfRoute(ProductCategoryController, 'findById')).toEqual([
			PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT
		]);

		// The read routes that do state the view permission state it here too, and never the edit one.
		for (const field of ['productCategories', 'productCategoryCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW]);
		}
	});
});
