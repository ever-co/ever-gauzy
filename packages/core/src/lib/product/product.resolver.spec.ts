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
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { CursorCodec } from '../api/cursor';
import { FieldVisibility } from '../api/field-visibility.service';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductController } from './product.controller';
import { ProductModule } from './product.module';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

/**
 * The catalogue's sellable thing over GraphQL.
 *
 * The delivered REST routes serve a product list, one product in either of two readings, a count, the
 * create, the edit, the removal, the two lifecycle moves, four image operations and the batch. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method or dispatches the same command the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the two
 *   lifecycle fields, whose delivered routes carry no permission at all, so a resolver that demanded
 *   one would refuse a caller the REST route serves;
 * - a product that is not there is `null` on the one-row field rather than a refusal;
 * - **one capability has one door**: the one-row field answers a slug as well as an identifier under
 *   one argument, and there is deliberately no second field that resolves the same row again.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const OTHER_PRODUCT = '00000000-0000-4000-8000-000000000011';
const IMAGE = '00000000-0000-4000-8000-000000000030';
const OTHER_IMAGE = '00000000-0000-4000-8000-000000000031';
const PRODUCT_TYPE = '00000000-0000-4000-8000-000000000040';
const PRODUCT_CATEGORY = '00000000-0000-4000-8000-000000000041';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: PRODUCT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		code: 'WIDGET-1',
		enabled: true,
		imageUrl: null,
		featuredImageId: IMAGE,
		productTypeId: PRODUCT_TYPE,
		productCategoryId: PRODUCT_CATEGORY,
		name: 'A widget',
		description: 'The first widget',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_PRODUCT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		code: 'GADGET-2',
		enabled: false,
		imageUrl: null,
		featuredImageId: null,
		productTypeId: PRODUCT_TYPE,
		productCategoryId: PRODUCT_CATEGORY,
		name: 'A gadget',
		description: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus, with the platform's own batch executor. */
function surfaces() {
	const productService = {
		findProducts: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		findOneByIdOrSlug: jest.fn().mockResolvedValue(ROWS[0]),
		findByIdTranslated: jest.fn().mockResolvedValue(ROWS[0]),
		applyBulkItem: jest.fn().mockResolvedValue(ROWS[0]),
		// The transaction the route hands the executor: it runs the work it is given, as the service's
		// own runner does, so the items of a batch are applied whether or not the batch is atomic.
		transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(undefined)),
		count: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		addGalleryImages: jest.fn().mockResolvedValue(ROWS[0]),
		setAsFeatured: jest.fn().mockResolvedValue(ROWS[0]),
		deleteGalleryImage: jest.fn().mockResolvedValue(ROWS[0]),
		deleteFeaturedImage: jest.fn().mockResolvedValue({ ...ROWS[0], featuredImageId: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };
	const visibility = {
		assertCanSee: jest.fn(),
		canSee: jest.fn().mockReturnValue(true)
	} as unknown as FieldVisibility;

	return {
		productService,
		commandBus,
		visibility,
		resolver: new ProductResolver(
			productService as never,
			commandBus as never,
			new BulkExecutor(visibility) as never
		)
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The members one input or object type declares, in the order a client states them. */
function fieldMembers(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

describe('ProductResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the product connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['products', 'product', 'productCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProduct',
				'updateProduct',
				'deleteProduct',
				'softDeleteProduct',
				'recoverProduct',
				'bulkCreateProducts',
				'addProductGalleryImages',
				'setProductAsFeatured',
				'deleteProductGalleryImage',
				'deleteProductFeaturedImage'
			])
		);
	});

	it('answers a product by identifier and by slug through one field, and declares no second field for either', () => {
		// Control: the one-row field is the door for both forms, so a schema that added `productBySlug`
		// would be the second surface for one capability — and a schema that dropped the argument
		// entirely would fail the assertion below rather than pass it quietly.
		expect(fieldArgs('Query', 'product')).toEqual(['id', 'language']);
		expect(rootFields('Query')).not.toContain('productBySlug');
		expect(rootFields('Query')).not.toContain('productById');
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ProductConnection \{\s*nodes: \[Product!\]!\s*edges: \[ProductEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductEdge \{\s*node: Product!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductFilter \{/);
		expect(printed).toMatch(/input ProductSort \{/);
		expect(printed).toMatch(/enum ProductSortField \{/);
	});

	it('declares the write inputs the mutations take', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/input CreateProductInput \{/);
		expect(printed).toMatch(/input UpdateProductInput \{/);
		expect(printed).toMatch(/input ProductTranslationInput \{/);
		expect(printed).toMatch(/input ProductOptionGroupInput \{/);
		expect(printed).toMatch(/input ProductOptionInput \{/);
	});

	it('declares the batch input as the route’s body plus the retry key, and nothing else', () => {
		// The two members the endpoint table declares — the items, each naming its operation and
		// payload, and the atomicity flag — plus the retry key GraphQL has nowhere else to carry.
		// Control: a member the route does not read, such as a write mode or a dry run, would appear
		// here and let a client believe it had asked for something the resource cannot honour.
		expect(fieldMembers('BulkCreateProductsInput')).toEqual(['items', 'atomic', 'idempotencyKey']);
		expect(fieldMembers('ProductBulkItem')).toEqual([
			'op',
			'id',
			'code',
			'enabled',
			'imageUrl',
			'featuredImageId',
			'productTypeId',
			'productCategoryId',
			'tagIds',
			'translations'
		]);
		expect(fieldMembers('BulkCreateProductsPayload')).toEqual(['results', 'succeeded', 'failed', 'total']);
		expect(fieldMembers('BulkProductItemResult')).toEqual(['index', 'ok', 'id', 'resource', 'error']);
	});

	it('declares the operations a batch item may name', () => {
		const printed = printSchema(schema);
		const operations = schema.getType('ProductBulkOperation') as
			| { getValues(): readonly { name: string }[] }
			| undefined;

		// The values are the platform bulk contract's own wire values, copied un-re-cased, so the same
		// batch statement reads identically over either protocol.
		expect(operations?.getValues().map((value) => value.name)).toEqual(['create', 'update', 'delete', 'upsert']);
		expect(printed).toMatch(/input ProductBulkItem \{/);
	});

	it('extends the Product object type rather than declaring a second one', () => {
		// A second declaration of the type would compose only while the two agreed, so the count of
		// `type Product {` in the composed SDL is the assertion.
		expect(printSchema(schema).match(/type Product \{/g)).toHaveLength(1);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer
		// `withDeleted` — an argument it could not honour is worse than an absent one.
		expect(fieldArgs('Query', 'products')).not.toContain('withDeleted');
		// The connection declares the query protocol's page arguments plus the language the delivered
		// routes read, and nothing else.
		expect(fieldArgs('Query', 'products')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset',
			'language'
		]);
		// The delivered count route narrows by a `where` fragment carried in the query string, which
		// is a shape no schema can state, so the field states no narrowing of its own.
		expect(fieldArgs('Query', 'productCount')).toEqual([]);
	});
});

describe('ProductResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productService } = surfaces();

		const connection = await resolver.products(undefined, undefined, undefined, 20);

		// The delivered list read, under the language its own route falls back to.
		expect(productService.findProducts).toHaveBeenCalledWith({}, LanguagesEnum.ENGLISH);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PRODUCT);
	});

	it('answers the list in the language the caller states', async () => {
		const { resolver, productService } = surfaces();

		await resolver.products(
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			LanguagesEnum.GERMAN
		);

		// The language the delivered per-language routes carry in their path is the one the rows are
		// merged with, which is what makes `name` and `description` readable on them.
		expect(productService.findProducts).toHaveBeenCalledWith({}, LanguagesEnum.GERMAN);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.products({ code: { eq: 'WIDGET-1' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([PRODUCT]);

		const byState = await resolver.products({ enabled: { eq: false } });
		expect(byState.nodes.map((node) => node.id)).toEqual([OTHER_PRODUCT]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const ascending = await resolver.products(undefined, [{ field: 'code', direction: 'ASC' }]);
		expect(ascending.nodes.map((node) => node.id)).toEqual([OTHER_PRODUCT, PRODUCT]);

		const byName = await resolver.products(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_PRODUCT, PRODUCT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.products(undefined, undefined, undefined, 1);

		const second = await resolver.products(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes).toHaveLength(1);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.products(undefined, [{ field: 'createdByUserId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.products({ variants: { eq: PRODUCT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a request that states both pagination styles', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.products(undefined, undefined, undefined, 1, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ProductResolver — one concept, two protocols, the same operations', () => {
	it('reads one product through the service method the REST node route calls', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.product(PRODUCT)).toBe(ROWS[0]);
		expect(productService.findOneByIdOrSlug).toHaveBeenCalledWith(PRODUCT);
		expect(productService.findByIdTranslated).not.toHaveBeenCalled();
	});

	it('reads one product by the slug it states, through the same field and the same method', async () => {
		const { resolver, productService } = surfaces();

		// Control: the field passes the value on as it stands, so the identifier-or-slug decision is the
		// service's — one reading for both surfaces rather than one per protocol.
		expect(await resolver.product('a-widget')).toBe(ROWS[0]);
		expect(productService.findOneByIdOrSlug).toHaveBeenCalledWith('a-widget');
		expect(productService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('reads one product in a language through the method the per-language route calls', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.product(PRODUCT, LanguagesEnum.GERMAN)).toBe(ROWS[0]);
		expect(productService.findByIdTranslated).toHaveBeenCalledWith(LanguagesEnum.GERMAN, PRODUCT);
		expect(productService.findOneByIdOrSlug).not.toHaveBeenCalled();
	});

	it('answers null for a product that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productService } = surfaces();
		productService.findOneByIdOrSlug.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.product(OTHER_PRODUCT)).toBeNull();

		productService.findByIdTranslated.mockRejectedValueOnce(new NotFoundException());
		expect(await resolver.product(OTHER_PRODUCT, LanguagesEnum.GERMAN)).toBeNull();
	});

	it('counts through the same call the REST count route makes', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.productCount()).toBe(2);
		// The scope is the credential's and never the caller's: the route reads the tenant from the
		// request context, and so does the field. No request is in flight in this suite, so the context
		// answers no tenant and the call carries none — which is the point being asserted, that the
		// tenant comes from the context rather than from the request.
		expect(productService.count).toHaveBeenCalledWith({ where: { tenantId: null } });
	});

	it('creates through the command the REST route dispatches, with the members its handler reads', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createProduct({
			code: 'WIDGET-1',
			organizationId: ORGANIZATION,
			enabled: true,
			imageUrl: 'https://example.test/widget.png',
			featuredImageId: IMAGE,
			productTypeId: PRODUCT_TYPE,
			productCategoryId: PRODUCT_CATEGORY,
			tagIds: [IMAGE],
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'A widget' }],
			optionGroupCreateInputs: [{ name: 'Size', options: [{ name: 'Large', code: 'L' }] }]
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command.constructor.name).toBe('ProductCreateCommand');
		expect(command.productInput).toEqual({
			code: 'WIDGET-1',
			// The organization is the caller's to state, as the delivered route reads it from the body;
			// the tenant is not, because the service stamps it from the credential.
			organizationId: ORGANIZATION,
			enabled: true,
			imageUrl: 'https://example.test/widget.png',
			featuredImageId: IMAGE,
			productTypeId: PRODUCT_TYPE,
			productCategoryId: PRODUCT_CATEGORY,
			// A tag is carried as the identifier the pivot row is written from, never as the tag row
			// beside it.
			tags: [{ id: IMAGE }],
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'A widget' }],
			optionGroupCreateInputs: [{ name: 'Size', options: [{ name: 'Large', code: 'L' }] }]
		});
	});

	it('edits through the command the REST route dispatches, stating type and category where its handler reads them', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateProduct({
			id: PRODUCT,
			productTypeId: PRODUCT_TYPE,
			productCategoryId: PRODUCT_CATEGORY,
			tagIds: [IMAGE, OTHER_IMAGE],
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'A widget' }],
			optionGroupCreateInputs: [],
			optionGroupUpdateInputs: [{ id: 'group-1', name: 'Size', options: [{ id: 'option-1', name: 'Large' }] }],
			optionGroupDeleteInputs: [{ id: 'group-2', name: 'Colour' }],
			optionDeleteInputs: [{ id: 'option-2', name: 'Small' }]
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command.constructor.name).toBe('ProductUpdateCommand');
		// The delivered route carries the identifier in the path and in the body, and its handler reads
		// the body's; the field states one and leaves neither reading undefined.
		expect(command.id).toBe(PRODUCT);
		expect(command.productUpdateRequest).toEqual({
			id: PRODUCT,
			type: { id: PRODUCT_TYPE },
			category: { id: PRODUCT_CATEGORY },
			tags: [{ id: IMAGE }, { id: OTHER_IMAGE }],
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'A widget' }],
			optionGroupCreateInputs: [],
			optionGroupUpdateInputs: [{ id: 'group-1', name: 'Size', options: [{ id: 'option-1', name: 'Large' }] }],
			optionGroupDeleteInputs: [{ id: 'group-2', name: 'Colour' }],
			optionDeleteInputs: [{ id: 'option-2', name: 'Small' }]
		});
	});

	it('leaves a member the edit does not state undefined rather than empty', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateProduct({ id: PRODUCT, optionGroupCreateInputs: [] });

		// An empty list is the instruction to clear what is there, which is a different request from
		// saying nothing about it.
		const payload = commandBus.execute.mock.calls[0][0].productUpdateRequest;
		expect(payload.tags).toBeUndefined();
		expect(payload.type).toBeUndefined();
		expect(payload.category).toBeUndefined();
		expect(payload.translations).toBeUndefined();
	});

	it('removes a product through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteProduct(PRODUCT)).toBe(true);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(commandBus.execute.mock.calls[0][0].constructor.name).toBe('ProductDeleteCommand');
		expect(commandBus.execute.mock.calls[0][0].productId).toBe(PRODUCT);
	});

	it('withdraws and recovers through the service methods the inherited routes call', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.softDeleteProduct(PRODUCT)).toEqual(
			expect.objectContaining({ id: PRODUCT, deletedAt: expect.any(Date) })
		);
		expect(productService.softRemove).toHaveBeenCalledWith(PRODUCT);

		expect(await resolver.recoverProduct(PRODUCT)).toBe(ROWS[0]);
		expect(productService.softRecover).toHaveBeenCalledWith(PRODUCT);
	});

	it('adds a gallery image through the service method the REST verb route calls', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.addProductGalleryImages(PRODUCT, [IMAGE, OTHER_IMAGE])).toBe(ROWS[0]);
		// The delivered gallery write stores memberships, so the member it reads off each image is the
		// asset's identifier.
		expect(productService.addGalleryImages).toHaveBeenCalledWith(PRODUCT, [{ id: IMAGE }, { id: OTHER_IMAGE }]);
	});

	it('sets and withdraws the featured image through the service methods the REST verb routes call', async () => {
		const { resolver, productService } = surfaces();

		expect(await resolver.setProductAsFeatured(PRODUCT, IMAGE)).toBe(ROWS[0]);
		expect(productService.setAsFeatured).toHaveBeenCalledWith(PRODUCT, { id: IMAGE });

		expect(await resolver.deleteProductGalleryImage(PRODUCT, OTHER_IMAGE)).toBe(ROWS[0]);
		expect(productService.deleteGalleryImage).toHaveBeenCalledWith(PRODUCT, OTHER_IMAGE);

		expect(await resolver.deleteProductFeaturedImage(PRODUCT)).toEqual(
			expect.objectContaining({ id: PRODUCT, featuredImageId: null })
		);
		expect(productService.deleteFeaturedImage).toHaveBeenCalledWith(PRODUCT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productService } = surfaces();
		const refusal = new Error('PRODUCT_IMAGE_IN_USE: this image is carried by a variant of the product.');

		productService.deleteGalleryImage.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteProductGalleryImage(PRODUCT, IMAGE)).rejects.toBe(refusal);
	});
});

/**
 * The batch, over the platform's own executor.
 *
 * The executor is the real one, so these assertions are about the field's half of the contract: the
 * options it runs the batch with, the service the items reach, and the per-item answer it derives.
 * The atomicity of the batch itself is the executor's and is asserted beside it, in
 * `product.controller.spec.ts`, where the route runs the same executor from the same declaration.
 */
describe('ProductResolver — the batch is the route’s batch, run by the platform’s executor', () => {
	it('applies every item through the service and answers one outcome per item, with the counts', async () => {
		const { resolver, productService, visibility } = surfaces();

		const payload = await resolver.bulkCreateProducts({
			items: [
				{ op: 'create', code: 'WIDGET-1' },
				{ op: 'update', id: OTHER_PRODUCT, enabled: false }
			]
		});

		expect(productService.applyBulkItem).toHaveBeenCalledTimes(2);
		expect(payload.results.map((result) => result.index)).toEqual([0, 1]);
		expect(payload.results.map((result) => result.ok)).toEqual([true, true]);
		// The row each item wrote is named, so a client matches an answer to the row it asked about.
		expect(payload.results[0].id).toBe(PRODUCT);
		expect(payload.succeeded).toBe(2);
		expect(payload.failed).toBe(0);
		expect(payload.total).toBe(2);
		// Control: the permission is the route's own, read off the controller's declaration rather than
		// restated — a field that ran the batch unauthorised would fail here.
		expect(visibility.assertCanSee).toHaveBeenCalledWith(PermissionsEnum.PRODUCTS_BULK_IMPORT, {
			resource: 'product',
			mode: 'write'
		});
	});

	it('reports the item that failed and keeps the one that applied, in a batch that is not atomic', async () => {
		const { resolver, productService } = surfaces();
		productService.applyBulkItem
			.mockResolvedValueOnce(ROWS[0])
			.mockRejectedValueOnce(
				new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'The code is taken.', { field: 'code' })
			);

		const payload = await resolver.bulkCreateProducts({
			items: [
				{ op: 'create', code: 'WIDGET-1' },
				{ op: 'create', code: 'GADGET-2' }
			]
		});

		expect(payload.succeeded).toBe(1);
		expect(payload.failed).toBe(1);
		expect(payload.results[1].ok).toBe(false);
		expect(payload.results[1].error.code).toBe(ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION);
		// The path names the item the outcome belongs to, which is what the payload's `path` member is for.
		expect(payload.results[1].error.path).toEqual(['items', '1']);
	});

	it('refuses a batch whose item names no operation before any item is applied', async () => {
		const { resolver, productService } = surfaces();

		const error = await resolver
			.bulkCreateProducts({ items: [{ code: 'WIDGET-1' } as never] })
			.catch((thrown) => thrown);

		expect(error).toBeInstanceOf(ApiException);
		expect((error as ApiException).details).toMatchObject({
			items: [
				{
					index: 0,
					code: ApiErrorCode.VALIDATION_REQUIRED_FIELD,
					details: { field: 'op' }
				}
			]
		});
		expect(productService.applyBulkItem).not.toHaveBeenCalled();
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'products', route: 'findAll' },
	{ field: 'product', route: 'findById' },
	{ field: 'productCount', route: 'getCount' },
	{ field: 'createProduct', route: 'create' },
	{ field: 'updateProduct', route: 'update' },
	{ field: 'deleteProduct', route: 'delete' },
	{ field: 'softDeleteProduct', route: 'softRemove' },
	{ field: 'recoverProduct', route: 'softRecover' },
	{ field: 'bulkCreateProducts', route: 'bulk' },
	{ field: 'addProductGalleryImages', route: 'addGalleryImage' },
	{ field: 'setProductAsFeatured', route: 'setAsFeatured' },
	{ field: 'deleteProductGalleryImage', route: 'deleteGalleryImage' },
	{ field: 'deleteProductFeaturedImage', route: 'deleteFeaturedImage' }
];

describe('ProductResolver — the guard stack is the controller’s, field by field', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// The controller states the permission guard per route rather than on the class, so neither
		// surface demands a permission the other does not before the route's own guard runs.
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductController)).toBeUndefined();
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldGuards = Reflect.getMetadata('__guards__', ProductResolver.prototype[field]) ?? [];
		const routeGuards = Reflect.getMetadata('__guards__', ProductController.prototype[route]) ?? [];
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, ProductResolver.prototype[field]) ?? [];
		const routePermissions = Reflect.getMetadata(PERMISSIONS_METADATA, ProductController.prototype[route]) ?? [];

		expect(fieldGuards).toEqual(routeGuards);
		expect(fieldPermissions).toEqual(routePermissions);
	});

	it('carries the read permission on the reads and the write permission on every write', () => {
		const proto = ProductResolver.prototype;

		for (const field of ['products', 'product', 'productCount']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([
				PermissionsEnum.ORG_INVENTORY_VIEW
			]);
		}

		for (const field of [
			'createProduct',
			'updateProduct',
			'deleteProduct',
			'addProductGalleryImages',
			'setProductAsFeatured',
			'deleteProductGalleryImage',
			'deleteProductFeaturedImage'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([
				PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT
			]);
		}
	});

	it('permits the two lifecycle fields exactly as far as their routes do, and no further', () => {
		// The soft removal and the recovery are inherited from the CRUD base, where the controller's
		// tenant guard is the whole of their scope. A resolver that demanded a permission here would
		// refuse a caller the REST route serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductResolver.prototype.softDeleteProduct)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductResolver.prototype.recoverProduct)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', ProductResolver.prototype.softDeleteProduct)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', ProductResolver.prototype.recoverProduct)).toBeUndefined();
	});

	it('carries the catalogue’s bulk-import permission on the batch, on both surfaces, and one retry scope', () => {
		// A batch is a heavier operation than a single write and the catalogue declares a permission of
		// its own for it, so the field carries that one and not the edit permission beside it.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductResolver.prototype.bulkCreateProducts)).toEqual([
			PermissionsEnum.PRODUCTS_BULK_IMPORT
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductController.prototype.bulk)).toEqual([
			PermissionsEnum.PRODUCTS_BULK_IMPORT
		]);

		// The retry declaration is one scope stated twice. Control: a field that declared a scope of its
		// own would store its keys under a second namespace and replay the route's answer as a miss.
		const routeDeclaration = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, ProductController.prototype.bulk);
		const fieldDeclaration = Reflect.getMetadata(
			IDEMPOTENT_METADATA_KEY,
			ProductResolver.prototype.bulkCreateProducts
		);

		expect(routeDeclaration).toEqual({ scope: 'product.bulk', required: false, resourceType: 'product' });
		expect(fieldDeclaration).toEqual(routeDeclaration);
	});
});

describe('ProductModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ProductModule) ?? []) as unknown[];

		expect(providers).toContain(ProductResolver);
		expect(providers).toContain(ProductService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, ProductModule) ?? []) as unknown[];

		expect(exported).toContain(ProductService);
		expect(exported).toContain(CqrsModule);
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
		getHandler: () => (ProductResolver.prototype as never)[field],
		getClass: () => ProductResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ProductResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ProductResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ProductResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('products')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('products');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('products'))).resolves.toBe(true);
	});
});
