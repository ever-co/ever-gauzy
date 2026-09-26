/**
 * The catalog list surface, against the soft-delete visibility the doctrine's parity table asks for.
 *
 * Doc 17 §3.1 requires a connection query to offer *"the same filters, the same sort keys, the same relation
 * loading and the same soft-delete visibility as the REST list route"*, and `withDeleted` is what states the
 * last of those. The failure this suite exists to catch is an argument the read drops: a list field that
 * declared the flag and never handed it to the find options answers the same page either way, so a client
 * that asked for the retired rows is told it can ask and is quietly given the live ones — which is worse than
 * a missing argument, because there is nothing to notice.
 *
 * `@gauzy/core` is doubled at the module boundary, as every suite in this package doubles it: its barrel
 * boots the whole application graph — configuration, the ORM, the job registry — none of which a resolver
 * needs and none of which is available outside a running application. **The connection helpers in that double
 * are the kernel's own implementations rather than stand-ins**: a `resolveConnectionWindow` invented here
 * would let the suite agree with itself about a window the platform does not compute.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	// Read through `requireActual`, which bypasses this factory: the connection contract is the kernel's, and
	// a double here would measure this file rather than the platform.
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
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class the
		// resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		BaseEvent: class {},
		EventBus: class {},
		Product: class {},
		ProductVariant: class {},
		Tag: class {},
		ImageAsset: class {},
		OrganizationContact: class {},
		Warehouse: class {},
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

import { print } from 'graphql';
import { CollectionResolver } from './resolvers/collection.resolver';
import { CollectionChannelResolver } from './resolvers/collection-channel.resolver';
import { CollectionProductResolver } from './resolvers/collection-product.resolver';
import { CollectionVariantResolver } from './resolvers/collection-variant.resolver';
import { ProductPublicationResolver } from './resolvers/product-publication.resolver';
import { ProductRelationResolver } from './resolvers/product-relation.resolver';
import { ProductVariantMediaResolver } from './resolvers/product-variant-media.resolver';
import { TagProductVariantResolver } from './resolvers/tag-product-variant.resolver';
import { schemaExtensions } from './schema-extensions';

/** The SDL as printed, so a declaration can be read the way a client reads it. */
const printed = print(schemaExtensions);

/**
 * The converted fields: the root field, the arguments it declares — every one it already declared, and the
 * soft-delete flag after them — and the connection it answers.
 *
 * The argument lists are stated in full rather than matched loosely, because the flag is not the only thing
 * this conversion can break: an argument dropped from a list field is a filter the REST route beside it
 * still accepts, and a client that moved protocol would lose it without anything going red.
 */
const CONVERTED: ReadonlyArray<readonly [string, string, string]> = [
	[
		'collections',
		'filter: CollectionFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'CollectionConnection'
	],
	[
		'collectionProducts',
		'filter: CollectionProductFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'CollectionProductConnection'
	],
	[
		'collectionVariants',
		'filter: CollectionVariantFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'CollectionVariantConnection'
	],
	[
		'collectionChannels',
		'filter: CollectionChannelFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'CollectionChannelConnection'
	],
	[
		'productPublications',
		'filter: ProductPublicationFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'ProductPublicationConnection'
	],
	[
		'productRelations',
		'filter: ProductRelationFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'ProductRelationConnection'
	],
	[
		'productVariantMedia',
		'filter: ProductVariantMediaFilter, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean',
		'ProductVariantMediaConnection'
	]
];

/** One converted field, and everything needed to drive it over a stubbed service. */
interface IFieldCase {
	/** The root field, as the SDL spells it. */
	readonly field: string;
	/** Builds the resolver over a service stub. */
	readonly build: (service: any) => any;
	/** Calls the field's resolver method with the soft-delete flag the caller stated. */
	readonly call: (resolver: any, withDeleted?: boolean) => Promise<unknown>;
}

/**
 * The seven converted fields, each with the read it delegates to.
 *
 * Every one of them answers from `findAll`, which is the read that carries `withDeleted` into the store, so
 * the stub that drives them is the same for all seven and the assertion below is about the resolver rather
 * than about the resource.
 */
const CASES: readonly IFieldCase[] = [
	{
		field: 'collections',
		build: (service) => new CollectionResolver(service, { ofType: () => null } as never),
		call: (resolver, withDeleted) => resolver.collections(undefined, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'collectionProducts',
		build: (service) => new CollectionProductResolver(service),
		call: (resolver, withDeleted) => resolver.collectionProducts({}, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'collectionVariants',
		build: (service) => new CollectionVariantResolver(service),
		call: (resolver, withDeleted) => resolver.collectionVariants({}, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'collectionChannels',
		build: (service) => new CollectionChannelResolver(service),
		call: (resolver, withDeleted) => resolver.collectionChannels({}, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'productPublications',
		build: (service) => new ProductPublicationResolver(service, {} as never, { ofType: () => null } as never),
		call: (resolver, withDeleted) =>
			resolver.productPublications({}, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'productRelations',
		build: (service) => new ProductRelationResolver(service),
		call: (resolver, withDeleted) => resolver.productRelations({}, undefined, undefined, undefined, withDeleted)
	},
	{
		field: 'productVariantMedia',
		build: (service) => new ProductVariantMediaResolver(service),
		call: (resolver, withDeleted) =>
			resolver.productVariantMedia({}, undefined, undefined, undefined, withDeleted)
	}
];

/** A service stub that answers one page. Only `findAll` exists, so a resolver reading any other seam fails. */
function serviceStub() {
	return { findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
}

describe('the catalog schema — the list fields offer the soft-delete visibility their routes offer', () => {
	it('declares each converted field with its own arguments and the flag after them', () => {
		for (const [field, args, connection] of CONVERTED) {
			expect(printed).toContain(`${field}(${args}): ${connection}!`);
		}
	});
});

describe('the catalog resolvers — the flag reaches the read the field delegates to', () => {
	it.each(CASES)('$field hands `withDeleted` to the read, and nothing when it was not asked for', async (testCase) => {
		const asked = serviceStub();

		await testCase.call(testCase.build(asked), true);

		// The read is the seam the flag has to cross: `findAll` honours `withDeleted` in its own find
		// options, so a resolver that keeps the argument to itself answers the live rows to a caller that
		// asked for the retired ones and reports nothing.
		expect(asked.findAll).toHaveBeenCalledTimes(1);
		expect(asked.findAll).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));

		// And a caller that asked for nothing hands the read no `withDeleted` at all rather than a `false`
		// this file invented: the read's own default is what an unflagged request means.
		const silent = serviceStub();

		await testCase.call(testCase.build(silent));

		expect(silent.findAll).toHaveBeenCalledTimes(1);
		expect(silent.findAll.mock.calls[0][0]).not.toHaveProperty('withDeleted');
	});

	/**
	 * Every store-paged list field of the package: the seven above, and the two whose soft-delete flag is
	 * pinned elsewhere but whose page is cut the same way.
	 */
	const PAGED: readonly IFieldCase[] = [
		...CASES,
		{
			field: 'productVariantPublications',
			build: (service) => new ProductPublicationResolver({} as never, service, { ofType: () => null } as never),
			call: (resolver, withDeleted) =>
				resolver.productVariantPublications({}, undefined, undefined, undefined, withDeleted)
		},
		{
			field: 'productVariantFacets',
			build: (service) => new TagProductVariantResolver(service),
			call: (resolver, withDeleted) =>
				resolver.productVariantFacets({}, undefined, undefined, undefined, withDeleted)
		}
	];

	it.each(PAGED)('$field reads its page in a total order, closed by the row’s identity', async (testCase) => {
		const asked = serviceStub();

		await testCase.call(testCase.build(asked));

		// The page is cut with LIMIT/OFFSET and its cursors are offsets, so the read has to state an order the
		// store cannot rearrange between two pages. An order with ties — or none — lets the planner, or a
		// Postgres `UPDATE` that moves a tuple, break them differently on the next page, and the walk repeats
		// one row and never shows another. The primary key is the one column that leaves no tie.
		const { order } = asked.findAll.mock.calls[0][0] as { order?: Record<string, string> };

		expect(order).toBeDefined();
		expect(Object.keys(order ?? {}).pop()).toBe('id');
	});
});
